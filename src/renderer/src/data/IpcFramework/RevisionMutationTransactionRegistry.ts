import type { Transaction } from '@tanstack/svelte-db'

export type TransactionEntry = {
  transaction: Transaction<any>
  queuedImmediately: boolean
}

type OpenUpdateTransaction = {
  transactionEntry: TransactionEntry
  debounceTimeoutId: ReturnType<typeof globalThis.setTimeout> | null
  enqueueTransaction: () => Promise<void>
}

type OpenUpdateTransactionFactoryResult = {
  transactionEntry: TransactionEntry
  enqueueTransaction: () => Promise<void>
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
const pendingOpenUpdateEnqueueTasks = new Set<Promise<void>>()

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

// Send a single open update transaction by key, canceling debounce first.
const sendOpenUpdateTransactionByGlobalElementKey = (
  globalElementKey: string
): void => {
  const openUpdateTransaction = openUpdateTransactionsByElement.get(globalElementKey)
  if (!openUpdateTransaction) {
    return
  }

  clearOpenUpdateDebounceTimeout(openUpdateTransaction)
  openUpdateTransactionsByElement.delete(globalElementKey)

  // Track enqueue tasks so submit-all can wait for both timer-triggered and forced sends.
  const trackedTask = openUpdateTransaction.enqueueTransaction().then(
    () => undefined,
    () => undefined
  )

  pendingOpenUpdateEnqueueTasks.add(trackedTask)
  void trackedTask.finally(() => {
    pendingOpenUpdateEnqueueTasks.delete(trackedTask)
  })
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
  queuedImmediately: boolean
): TransactionEntry => {
  const transactionEntry: TransactionEntry = {
    transaction,
    queuedImmediately
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
  let createdTransaction: OpenUpdateTransactionFactoryResult | null = null

  if (!openUpdateTransaction) {
    createdTransaction = createTransaction()
    openUpdateTransaction = {
      transactionEntry: createdTransaction.transactionEntry,
      debounceTimeoutId: null,
      enqueueTransaction: createdTransaction.enqueueTransaction
    }
    openUpdateTransactionsByElement.set(globalElementKey, openUpdateTransaction)
  }

  try {
    mutateTransaction(openUpdateTransaction.transactionEntry.transaction)
    syncRevisionMutationTransactionIndex(openUpdateTransaction.transactionEntry.transaction.id)
  } catch (error) {
    if (createdTransaction) {
      clearRevisionMutationTransaction(createdTransaction.transactionEntry.transaction.id)
      openUpdateTransactionsByElement.delete(globalElementKey)
    }

    throw error
  }

  clearOpenUpdateDebounceTimeout(openUpdateTransaction)
  openUpdateTransaction.debounceTimeoutId = globalThis.setTimeout(() => {
    sendOpenUpdateTransactionIfPresent(collectionId, elementId)
  }, debounceMs)
}

// Fire-and-forget send of a per-element open update transaction, if one exists.
export const sendOpenUpdateTransactionIfPresent = (
  collectionId: string,
  elementId: string | number
): void => {
  sendOpenUpdateTransactionByGlobalElementKey(buildGlobalElementKey(collectionId, elementId))
}

// Submit all open update transactions and wait for every enqueue task to settle.
export const submitAllOpenUpdateTransactionsAndWait = async (): Promise<void> => {
  while (openUpdateTransactionsByElement.size > 0) {
    const openTransactionKeys = [...openUpdateTransactionsByElement.keys()]
    for (const openTransactionKey of openTransactionKeys) {
      sendOpenUpdateTransactionByGlobalElementKey(openTransactionKey)
    }

    while (pendingOpenUpdateEnqueueTasks.size > 0) {
      await Promise.allSettled([...pendingOpenUpdateEnqueueTasks])
    }
  }

  while (pendingOpenUpdateEnqueueTasks.size > 0) {
    await Promise.allSettled([...pendingOpenUpdateEnqueueTasks])
  }
}
