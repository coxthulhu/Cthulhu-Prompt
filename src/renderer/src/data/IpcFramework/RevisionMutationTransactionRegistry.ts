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

const transactionEntries = new Map<string, TransactionEntry>()
const transactionKeys = new Map<string, Set<string>>()
const transactionsByElement = new Map<string, Set<TransactionEntry>>()
const openUpdateTransactionsByElement = new Map<string, OpenUpdateTransaction>()
const inFlightOpenUpdateEnqueueTasksByElement = new Map<string, Promise<void>>()
let latestTrackedOpenUpdateEnqueueTask: Promise<void> = Promise.resolve()

// Keep element keys aligned with TanStack's global mutation key format.
const buildGlobalElementKey = (
  collectionId: string,
  elementId: string | number
): string => {
  return `KEY::${collectionId}/${elementId}`
}

const getOrCreateElementTransactions = (
  globalElementKey: string
): Set<TransactionEntry> => {
  let elementTransactions = transactionsByElement.get(globalElementKey)

  if (!elementTransactions) {
    elementTransactions = new Set<TransactionEntry>()
    transactionsByElement.set(globalElementKey, elementTransactions)
  }

  return elementTransactions
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

  latestTrackedOpenUpdateEnqueueTask = trackedTask
  inFlightOpenUpdateEnqueueTasksByElement.set(globalElementKey, trackedTask)
  void trackedTask.finally(() => {
    if (inFlightOpenUpdateEnqueueTasksByElement.get(globalElementKey) !== trackedTask) {
      return
    }

    inFlightOpenUpdateEnqueueTasksByElement.delete(globalElementKey)
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
    waitTask: inFlightOpenUpdateEnqueueTasksByElement.get(globalElementKey) ?? null
  }
}

// Send a single open update transaction by key, canceling debounce first.
const sendOpenUpdateTransactionByGlobalElementKey = (
  globalElementKey: string,
  reason: OpenUpdateSendReason
): Promise<void> | null => {
  const openUpdateTransaction = openUpdateTransactionsByElement.get(globalElementKey)
  if (!openUpdateTransaction) {
    return null
  }

  const transaction = openUpdateTransaction.transactionEntry.transaction
  clearOpenUpdateDebounceTimeout(openUpdateTransaction)

  let isValid = true
  if (openUpdateTransaction.validateBeforeEnqueue) {
    isValid = openUpdateTransaction.validateBeforeEnqueue(transaction)
    syncRevisionMutationTransactionIndex(transaction.id)
  }

  if (!isValid) {
    if (reason === 'before-immediate-transaction') {
      openUpdateTransactionsByElement.delete(globalElementKey)
      try {
        if (transaction.state === 'pending') {
          transaction.rollback({
            isSecondaryRollback: true
          })
        }
      } finally {
        clearRevisionMutationTransaction(transaction.id)
      }
    }

    return null
  }

  openUpdateTransactionsByElement.delete(globalElementKey)
  return trackOpenUpdateEnqueueTask(
    globalElementKey,
    openUpdateTransaction.enqueueTransaction()
  )
}

// Recompute per-element transaction indexes from the transaction's current mutation set.
export const syncRevisionMutationTransactionIndex = (
  transactionId: string
): void => {
  const transactionEntry = transactionEntries.get(transactionId)!
  const previousKeys = transactionKeys.get(transactionId) ?? new Set<string>()
  const nextKeys = new Set(
    transactionEntry.transaction.mutations.map((mutation) => mutation.globalKey)
  )

  for (const previousKey of previousKeys) {
    if (nextKeys.has(previousKey)) {
      continue
    }

    const elementTransactions = transactionsByElement.get(previousKey)
    if (!elementTransactions) {
      continue
    }

    elementTransactions.delete(transactionEntry)
    if (elementTransactions.size === 0) {
      transactionsByElement.delete(previousKey)
    }
  }

  for (const nextKey of nextKeys) {
    if (previousKeys.has(nextKey)) {
      continue
    }

    getOrCreateElementTransactions(nextKey).add(transactionEntry)
  }

  transactionKeys.set(transactionId, nextKeys)
}

// Register a transaction so it can be looked up by id and by mutated element key.
export const registerRevisionMutationTransaction = (
  transaction: Transaction<any>,
  isQueuedImmediately: boolean
): TransactionEntry => {
  const transactionEntry: TransactionEntry = {
    transaction,
    isQueuedImmediately
  }

  transactionEntries.set(transaction.id, transactionEntry)
  transactionKeys.set(transaction.id, new Set())

  return transactionEntry
}

// Remove a transaction from all indexes and per-element lookup sets.
export const clearRevisionMutationTransaction = (transactionId: string): void => {
  const transactionEntry = transactionEntries.get(transactionId)
  if (!transactionEntry) {
    return
  }

  const indexedKeys = transactionKeys.get(transactionId) ?? new Set<string>()
  for (const indexedKey of indexedKeys) {
    const elementTransactions = transactionsByElement.get(indexedKey)
    if (!elementTransactions) {
      continue
    }

    elementTransactions.delete(transactionEntry)
    if (elementTransactions.size === 0) {
      transactionsByElement.delete(indexedKey)
    }
  }

  transactionKeys.delete(transactionId)
  transactionEntries.delete(transactionId)
}

// Read all currently indexed transactions for one (collectionId, elementId) pair.
export const getTransactionsForElement = (
  collectionId: string,
  elementId: string | number
): Set<TransactionEntry> => {
  return getOrCreateElementTransactions(buildGlobalElementKey(collectionId, elementId))
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
  let openUpdateTransaction = openUpdateTransactionsByElement.get(globalElementKey)
  let newOpenUpdateTransaction: OpenUpdateTransactionFactoryResult | null = null

  if (!openUpdateTransaction) {
    newOpenUpdateTransaction = createTransaction()
    openUpdateTransaction = {
      transactionEntry: newOpenUpdateTransaction.transactionEntry,
      debounceTimeoutId: null,
      enqueueTransaction: newOpenUpdateTransaction.enqueueTransaction,
      validateBeforeEnqueue: newOpenUpdateTransaction.validateBeforeEnqueue
    }
    openUpdateTransactionsByElement.set(globalElementKey, openUpdateTransaction)
  }

  try {
    mutateTransaction(openUpdateTransaction.transactionEntry.transaction)
    syncRevisionMutationTransactionIndex(openUpdateTransaction.transactionEntry.transaction.id)
  } catch (error) {
    if (newOpenUpdateTransaction) {
      clearRevisionMutationTransaction(newOpenUpdateTransaction.transactionEntry.transaction.id)
      openUpdateTransactionsByElement.delete(globalElementKey)
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

// Submit all open update transactions and wait for every enqueue task to settle.
export const submitAllOpenUpdateTransactionsAndWait = async (): Promise<void> => {
  while (true) {
    const openTransactionKeys = [...openUpdateTransactionsByElement.keys()]
    let didSendAny = false

    for (const openTransactionKey of openTransactionKeys) {
      const dispatchResult = dispatchOpenUpdateTransaction(
        openTransactionKey,
        'manual',
        false
      )
      didSendAny = didSendAny || dispatchResult.wasSent
    }

    await latestTrackedOpenUpdateEnqueueTask

    if (!didSendAny) {
      return
    }
  }
}
