import type { Transaction } from '@tanstack/svelte-db'

type PacedUpdateTransactionBase = {
  transaction: Transaction<any>
  enqueueTransaction: () => Promise<void>
  validateBeforeEnqueue?: (transaction: Transaction<any>) => boolean
}

type PacedUpdateSendReason = 'debounce' | 'manual' | 'before-immediate-transaction'

type PacedUpdateTransaction = PacedUpdateTransactionBase & {
  debounceTimeoutId: ReturnType<typeof globalThis.setTimeout> | null
}

type MutatePacedUpdateTransactionOptions = {
  collectionId: string
  elementId: string | number
  debounceMs: number
  createTransaction: () => PacedUpdateTransactionBase
  mutateTransaction: (transaction: Transaction<any>) => void
  createIfMissing?: boolean
  restartDebounceTimer?: boolean
}

type ElementPacedUpdateState = {
  pacedUpdateTransaction: PacedUpdateTransaction | null
  // We only track the latest task because mutation commits are globally serialized.
  latestInFlightPacedUpdateEnqueueTask: Promise<void> | null
}

const elementStatesByGlobalKey = new Map<string, ElementPacedUpdateState>()

// Keep element keys aligned with TanStack's global mutation key format.
export const buildGlobalElementKey = (
  collectionId: string,
  elementId: string | number
): string => {
  return `KEY::${collectionId}/${elementId}`
}

const getOrCreateElementState = (
  globalElementKey: string
): ElementPacedUpdateState => {
  let elementState = elementStatesByGlobalKey.get(globalElementKey)

  if (!elementState) {
    elementState = {
      pacedUpdateTransaction: null,
      latestInFlightPacedUpdateEnqueueTask: null
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

  if (elementState.pacedUpdateTransaction || elementState.latestInFlightPacedUpdateEnqueueTask) {
    return
  }

  elementStatesByGlobalKey.delete(globalElementKey)
}

// Side effect: cancel any active debounce timer for a paced update transaction.
const clearPacedUpdateDebounceTimeout = (pacedUpdateTransaction: PacedUpdateTransaction): void => {
  if (pacedUpdateTransaction.debounceTimeoutId == null) {
    return
  }

  globalThis.clearTimeout(pacedUpdateTransaction.debounceTimeoutId)
  pacedUpdateTransaction.debounceTimeoutId = null
}

const trackPacedUpdateEnqueueTask = (
  globalElementKey: string,
  enqueuePromise: Promise<void>
): Promise<void> => {
  const trackedTask = enqueuePromise.then(
    () => undefined,
    () => undefined
  )
  const elementState = getOrCreateElementState(globalElementKey)
  elementState.latestInFlightPacedUpdateEnqueueTask = trackedTask

  void trackedTask.finally(() => {
    const latestElementState = elementStatesByGlobalKey.get(globalElementKey)
    if (!latestElementState) {
      return
    }

    if (latestElementState.latestInFlightPacedUpdateEnqueueTask !== trackedTask) {
      return
    }

    latestElementState.latestInFlightPacedUpdateEnqueueTask = null
    cleanupElementStateIfIdle(globalElementKey)
  })

  return trackedTask
}

type PacedUpdateDispatchResult = {
  wasSent: boolean
  waitTask: Promise<void> | null
}

const sendPacedUpdateTransactionByGlobalElementKey = (
  globalElementKey: string,
  reason: PacedUpdateSendReason,
  includeInFlightTask: boolean
): PacedUpdateDispatchResult => {
  const elementState = elementStatesByGlobalKey.get(globalElementKey)
  if (!elementState || !elementState.pacedUpdateTransaction) {
    return {
      wasSent: false,
      waitTask: includeInFlightTask ? (elementState?.latestInFlightPacedUpdateEnqueueTask ?? null) : null
    }
  }

  const pacedUpdateTransaction = elementState.pacedUpdateTransaction
  const transaction = pacedUpdateTransaction.transaction
  clearPacedUpdateDebounceTimeout(pacedUpdateTransaction)

  if (pacedUpdateTransaction.validateBeforeEnqueue?.(transaction) === false) {
    if (reason === 'before-immediate-transaction') {
      elementState.pacedUpdateTransaction = null
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
      waitTask: includeInFlightTask ? (elementState.latestInFlightPacedUpdateEnqueueTask ?? null) : null
    }
  }

  elementState.pacedUpdateTransaction = null
  const waitTask = trackPacedUpdateEnqueueTask(
    globalElementKey,
    pacedUpdateTransaction.enqueueTransaction()
  )

  return {
    wasSent: true,
    waitTask
  }
}

// Mutate a per-element paced update transaction and restart its debounce window.
export const mutatePacedUpdateTransaction = ({
  collectionId,
  elementId,
  debounceMs,
  createTransaction,
  mutateTransaction,
  createIfMissing = true,
  restartDebounceTimer = true
}: MutatePacedUpdateTransactionOptions): boolean => {
  const globalElementKey = buildGlobalElementKey(collectionId, elementId)
  const elementState = getOrCreateElementState(globalElementKey)
  let pacedUpdateTransaction = elementState.pacedUpdateTransaction

  if (!pacedUpdateTransaction) {
    if (!createIfMissing) {
      cleanupElementStateIfIdle(globalElementKey)
      return false
    }

    const createdPacedUpdateTransaction = createTransaction()
    pacedUpdateTransaction = {
      debounceTimeoutId: null,
      transaction: createdPacedUpdateTransaction.transaction,
      enqueueTransaction: createdPacedUpdateTransaction.enqueueTransaction,
      validateBeforeEnqueue: createdPacedUpdateTransaction.validateBeforeEnqueue
    }
    elementState.pacedUpdateTransaction = pacedUpdateTransaction
  }

  mutateTransaction(pacedUpdateTransaction.transaction)

  if (!restartDebounceTimer) {
    return true
  }

  clearPacedUpdateDebounceTimeout(pacedUpdateTransaction)
  pacedUpdateTransaction.debounceTimeoutId = globalThis.setTimeout(() => {
    sendPacedUpdateTransactionIfPresent(collectionId, elementId, 'debounce')
  }, debounceMs)

  return true
}

// Fire-and-forget send of a per-element paced update transaction, if one exists.
export const sendPacedUpdateTransactionIfPresent = (
  collectionId: string,
  elementId: string | number,
  reason: PacedUpdateSendReason = 'manual'
): boolean => {
  const dispatchResult = sendPacedUpdateTransactionByGlobalElementKey(
    buildGlobalElementKey(collectionId, elementId),
    reason,
    false
  )

  return dispatchResult.wasSent
}

// Submit one paced update transaction (if present) and wait for its enqueue task to settle.
export const submitPacedUpdateTransactionAndWait = async (
  collectionId: string,
  elementId: string | number
): Promise<void> => {
  const globalElementKey = buildGlobalElementKey(collectionId, elementId)
  const dispatchResult = sendPacedUpdateTransactionByGlobalElementKey(
    globalElementKey,
    'manual',
    true
  )

  if (dispatchResult.waitTask) {
    await dispatchResult.waitTask
  }
}

// Submit all current paced update transactions and wait for current enqueue work.
export const submitAllPacedUpdateTransactionsAndWait = async (): Promise<void> => {
  const waitTasks = new Set<Promise<void>>()

  for (const [globalElementKey, elementState] of elementStatesByGlobalKey.entries()) {
    if (elementState.latestInFlightPacedUpdateEnqueueTask) {
      waitTasks.add(elementState.latestInFlightPacedUpdateEnqueueTask)
    }

    if (!elementState.pacedUpdateTransaction) {
      continue
    }

    const dispatchResult = sendPacedUpdateTransactionByGlobalElementKey(
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
