import type { Transaction } from '@tanstack/svelte-db'

type OpenUpdateTransactionBase = {
  transaction: Transaction<any>
  enqueueTransaction: () => Promise<void>
  validateBeforeEnqueue?: (transaction: Transaction<any>) => boolean
}

export type OpenUpdateSendReason = 'debounce' | 'manual' | 'before-immediate-transaction'

type OpenUpdateTransaction = OpenUpdateTransactionBase & {
  debounceTimeoutId: ReturnType<typeof globalThis.setTimeout> | null
}

type MutateOpenUpdateTransactionOptions = {
  collectionId: string
  elementId: string | number
  debounceMs: number
  createTransaction: () => OpenUpdateTransactionBase
  mutateTransaction: (transaction: Transaction<any>) => void
}

type ElementOpenUpdateState = {
  openUpdateTransaction: OpenUpdateTransaction | null
  // We only track the latest task because mutation commits are globally serialized.
  latestInFlightOpenUpdateEnqueueTask: Promise<void> | null
}

const elementStatesByGlobalKey = new Map<string, ElementOpenUpdateState>()

// Keep element keys aligned with TanStack's global mutation key format.
export const buildGlobalElementKey = (
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

const sendOpenUpdateTransactionByGlobalElementKey = (
  globalElementKey: string,
  reason: OpenUpdateSendReason,
  includeInFlightTask: boolean
): OpenUpdateDispatchResult => {
  const elementState = elementStatesByGlobalKey.get(globalElementKey)
  if (!elementState || !elementState.openUpdateTransaction) {
    return {
      wasSent: false,
      waitTask: includeInFlightTask ? (elementState?.latestInFlightOpenUpdateEnqueueTask ?? null) : null
    }
  }

  const openUpdateTransaction = elementState.openUpdateTransaction
  const transaction = openUpdateTransaction.transaction
  clearOpenUpdateDebounceTimeout(openUpdateTransaction)

  if (openUpdateTransaction.validateBeforeEnqueue?.(transaction) === false) {
    if (reason === 'before-immediate-transaction') {
      elementState.openUpdateTransaction = null
      try {
        if (transaction.state === 'pending') {
          transaction.rollback({
            isSecondaryRollback: true
          })
        }
      } finally {
        cleanupElementStateIfIdle(globalElementKey)
      }
    }

    return {
      wasSent: false,
      waitTask: includeInFlightTask ? (elementState.latestInFlightOpenUpdateEnqueueTask ?? null) : null
    }
  }

  elementState.openUpdateTransaction = null
  const waitTask = trackOpenUpdateEnqueueTask(
    globalElementKey,
    openUpdateTransaction.enqueueTransaction()
  )

  return {
    wasSent: true,
    waitTask
  }
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

  if (!openUpdateTransaction) {
    const createdOpenUpdateTransaction = createTransaction()
    openUpdateTransaction = {
      debounceTimeoutId: null,
      transaction: createdOpenUpdateTransaction.transaction,
      enqueueTransaction: createdOpenUpdateTransaction.enqueueTransaction,
      validateBeforeEnqueue: createdOpenUpdateTransaction.validateBeforeEnqueue
    }
    elementState.openUpdateTransaction = openUpdateTransaction
  }

  mutateTransaction(openUpdateTransaction.transaction)

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
  const dispatchResult = sendOpenUpdateTransactionByGlobalElementKey(
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
  const dispatchResult = sendOpenUpdateTransactionByGlobalElementKey(
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

    const dispatchResult = sendOpenUpdateTransactionByGlobalElementKey(
      globalElementKey,
      'manual',
      false
    )
    if (dispatchResult.waitTask) {
      waitTasks.add(dispatchResult.waitTask)
    }
  }

  await Promise.all([...waitTasks])
}
