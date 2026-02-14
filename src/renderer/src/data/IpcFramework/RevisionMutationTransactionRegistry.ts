import type { Transaction } from '@tanstack/svelte-db'

export type TransactionEntry = {
  transaction: Transaction<any>
  queuedImmediately: boolean
}

const transactionEntries = new Map<string, TransactionEntry>()
const transactionKeys = new Map<string, Set<string>>()
const transactionsByElement = new Map<string, Set<TransactionEntry>>()

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

export const getTransactionsForElement = (
  collectionId: string,
  elementId: string | number
): Set<TransactionEntry> => {
  return getOrCreateElementTransactions(buildGlobalElementKey(collectionId, elementId))
}
