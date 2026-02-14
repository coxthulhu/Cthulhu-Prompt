import type { Transaction } from '@tanstack/svelte-db'

export type TransactionEntry = {
  transaction: Transaction<any>
  isQueuedImmediately: boolean
}

export type OpenUpdateSendReason = 'debounce' | 'manual' | 'before-immediate-transaction'

type OpenUpdateTransaction = {
  transactionEntry: TransactionEntry
  debounceTimeoutId: ReturnType<typeof globalThis.setTimeout> | null
  enqueueTransaction: () => Promise<void>
  validateBeforeEnqueue?: (transaction: Transaction<any>) => boolean
}

type OpenUpdateTransactionFactoryResult = {
  transactionEntry: TransactionEntry
  enqueueTransaction: () => Promise<void>
  validateBeforeEnqueue?: (transaction: Transaction<any>) => boolean
}

type MutateOpenUpdateTransactionOptions = {
  collectionId: string
  elementId: string | number
  debounceMs: number
  createTransaction: () => OpenUpdateTransactionFactoryResult
  mutateTransaction: (transaction: Transaction<any>) => void
}

type ElementOpenUpdateState = {
  openUpdateTransaction: OpenUpdateTransaction | null
  // We only track the latest task because mutation commits are globally serialized.
  latestInFlightOpenUpdateEnqueueTask: Promise<void> | null
}

const transactionsById = new Map<string, TransactionEntry>()
const elementStatesByGlobalKey = new Map<string, ElementOpenUpdateState>()

// Keep element keys aligned with TanStack's global mutation key format.
const buildGlobalElementKey = (
  collectionId: string,
  elementId: string | number
): string => {
  return `KEY::${collectionId}/${elementId}`
}

const getOrCreateElementState = (
  globalElementKey: string
): ElementOpenUpdateState => {
  let elementState = elementStatesByGlobalKey.get(globalElementKey)

  if (!elementState) {
    elementState = {
      openUpdateTransaction: null,
      latestInFlightOpenUpdateEnqueueTask: null
    }
    elementStatesByGlobalKey.set(globalElementKey, elementState)
  }

  return elementState
}

const cleanupElementStateIfIdle = (globalElementKey: string): void => {
  const elementState = elementStatesByGlobalKey.get(globalElementKey)
  if (!elementState) {
    return
  }

  if (elementState.openUpdateTransaction || elementState.latestInFlightOpenUpdateEnqueueTask) {
    return
  }

  elementStatesByGlobalKey.delete(globalElementKey)
}

// Side effect: cancel any active debounce timer for an open update transaction.
const clearOpenUpdateDebounceTimeout = (openUpdateTransaction: OpenUpdateTransaction): void => {
  if (openUpdateTransaction.debounceTimeoutId == null) {
    return
  }

  globalThis.clearTimeout(openUpdateTransaction.debounceTimeoutId)
  openUpdateTransaction.debounceTimeoutId = null
}

const trackOpenUpdateEnqueueTask = (
  globalElementKey: string,
  enqueuePromise: Promise<void>
): Promise<void> => {
  const trackedTask = enqueuePromise.then(
    () => undefined,
    () => undefined
  )
  const elementState = getOrCreateElementState(globalElementKey)
  elementState.latestInFlightOpenUpdateEnqueueTask = trackedTask

  void trackedTask.finally(() => {
    const latestElementState = elementStatesByGlobalKey.get(globalElementKey)
    if (!latestElementState) {
      return
    }

    if (latestElementState.latestInFlightOpenUpdateEnqueueTask !== trackedTask) {
      return
    }

    latestElementState.latestInFlightOpenUpdateEnqueueTask = null
    cleanupElementStateIfIdle(globalElementKey)
  })

  return trackedTask
}

type OpenUpdateDispatchResult = {
  wasSent: boolean
  waitTask: Promise<void> | null
}

const dispatchOpenUpdateTransaction = (
  globalElementKey: string,
  reason: OpenUpdateSendReason,
  includeInFlightTask: boolean
): OpenUpdateDispatchResult => {
  const enqueueTask = sendOpenUpdateTransactionByGlobalElementKey(globalElementKey, reason)
  if (enqueueTask) {
    return {
      wasSent: true,
      waitTask: enqueueTask
    }
  }

  if (!includeInFlightTask) {
    return {
      wasSent: false,
      waitTask: null
    }
  }

  return {
    wasSent: false,
    waitTask:
      elementStatesByGlobalKey.get(globalElementKey)?.latestInFlightOpenUpdateEnqueueTask ?? null
  }
}

// Send a single open update transaction by key, canceling debounce first.
const sendOpenUpdateTransactionByGlobalElementKey = (
  globalElementKey: string,
  reason: OpenUpdateSendReason
): Promise<void> | null => {
  const elementState = elementStatesByGlobalKey.get(globalElementKey)
  const openUpdateTransaction = elementState?.openUpdateTransaction
  if (!openUpdateTransaction) {
    return null
  }

  const transaction = openUpdateTransaction.transactionEntry.transaction
  clearOpenUpdateDebounceTimeout(openUpdateTransaction)

  let isValid = true
  if (openUpdateTransaction.validateBeforeEnqueue) {
    isValid = openUpdateTransaction.validateBeforeEnqueue(transaction)
  }

  if (!isValid) {
    if (reason === 'before-immediate-transaction') {
      elementState.openUpdateTransaction = null
      try {
        if (transaction.state === 'pending') {
          transaction.rollback({
            isSecondaryRollback: true
          })
        }
      } finally {
        clearRevisionMutationTransaction(transaction.id)
        cleanupElementStateIfIdle(globalElementKey)
      }
    }

    return null
  }

  elementState.openUpdateTransaction = null
  return trackOpenUpdateEnqueueTask(
    globalElementKey,
    openUpdateTransaction.enqueueTransaction()
  )
}

// Register a transaction so it can be looked up by id.
export const registerRevisionMutationTransaction = (
  transaction: Transaction<any>,
  isQueuedImmediately: boolean
): TransactionEntry => {
  const transactionEntry: TransactionEntry = {
    transaction,
    isQueuedImmediately
  }

  transactionsById.set(transaction.id, transactionEntry)

  return transactionEntry
}

// Remove a tracked transaction entry.
export const clearRevisionMutationTransaction = (transactionId: string): void => {
  transactionsById.delete(transactionId)
}

// Read a snapshot of currently indexed transactions for one (collectionId, elementId) pair.
export const getTransactionsForElement = (
  collectionId: string,
  elementId: string | number
): TransactionEntry[] => {
  const globalElementKey = buildGlobalElementKey(collectionId, elementId)

  return [...transactionsById.values()].filter((transactionEntry) => {
    return transactionEntry.transaction.mutations.some(
      (mutation) => mutation.globalKey === globalElementKey
    )
  })
}

// Mutate a per-element open update transaction and restart its debounce window.
export const mutateOpenUpdateTransaction = ({
  collectionId,
  elementId,
  debounceMs,
  createTransaction,
  mutateTransaction
}: MutateOpenUpdateTransactionOptions): void => {
  const globalElementKey = buildGlobalElementKey(collectionId, elementId)
  const elementState = getOrCreateElementState(globalElementKey)
  let openUpdateTransaction = elementState.openUpdateTransaction
  let newOpenUpdateTransaction: OpenUpdateTransactionFactoryResult | null = null

  if (!openUpdateTransaction) {
    newOpenUpdateTransaction = createTransaction()
    openUpdateTransaction = {
      transactionEntry: newOpenUpdateTransaction.transactionEntry,
      debounceTimeoutId: null,
      enqueueTransaction: newOpenUpdateTransaction.enqueueTransaction,
      validateBeforeEnqueue: newOpenUpdateTransaction.validateBeforeEnqueue
    }
    elementState.openUpdateTransaction = openUpdateTransaction
  }

  try {
    mutateTransaction(openUpdateTransaction.transactionEntry.transaction)
  } catch (error) {
    if (newOpenUpdateTransaction) {
      clearRevisionMutationTransaction(newOpenUpdateTransaction.transactionEntry.transaction.id)
      elementState.openUpdateTransaction = null
      cleanupElementStateIfIdle(globalElementKey)
    }

    throw error
  }

  clearOpenUpdateDebounceTimeout(openUpdateTransaction)
  openUpdateTransaction.debounceTimeoutId = globalThis.setTimeout(() => {
    sendOpenUpdateTransactionIfPresent(collectionId, elementId, 'debounce')
  }, debounceMs)
}

// Fire-and-forget send of a per-element open update transaction, if one exists.
export const sendOpenUpdateTransactionIfPresent = (
  collectionId: string,
  elementId: string | number,
  reason: OpenUpdateSendReason = 'manual'
): boolean => {
  const dispatchResult = dispatchOpenUpdateTransaction(
    buildGlobalElementKey(collectionId, elementId),
    reason,
    false
  )

  return dispatchResult.wasSent
}

// Submit one open update transaction (if present) and wait for its enqueue task to settle.
export const submitOpenUpdateTransactionAndWait = async (
  collectionId: string,
  elementId: string | number
): Promise<void> => {
  const globalElementKey = buildGlobalElementKey(collectionId, elementId)
  const dispatchResult = dispatchOpenUpdateTransaction(
    globalElementKey,
    'manual',
    true
  )

  if (dispatchResult.waitTask) {
    await dispatchResult.waitTask
  }
}

// Submit all currently open update transactions and wait for current enqueue work.
export const submitAllOpenUpdateTransactionsAndWait = async (): Promise<void> => {
  const waitTasks = new Set<Promise<void>>()

  for (const [globalElementKey, elementState] of elementStatesByGlobalKey.entries()) {
    if (elementState.latestInFlightOpenUpdateEnqueueTask) {
      waitTasks.add(elementState.latestInFlightOpenUpdateEnqueueTask)
    }

    if (!elementState.openUpdateTransaction) {
      continue
    }

    const enqueueTask = sendOpenUpdateTransactionByGlobalElementKey(globalElementKey, 'manual')
    if (enqueueTask) {
      waitTasks.add(enqueueTask)
    }
  }

  await Promise.all([...waitTasks])
}
