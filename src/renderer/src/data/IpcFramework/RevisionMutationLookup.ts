import type { Transaction } from '@tanstack/svelte-db'

export const getLatestMutationModifiedRecord = <TRecord>(
  transaction: Transaction<any>,
  collectionId: string,
  elementId: string | number,
  fallback: () => TRecord
): TRecord => {
  for (let index = transaction.mutations.length - 1; index >= 0; index -= 1) {
    const mutation = transaction.mutations[index]!

    if (mutation.collection.id === collectionId && mutation.key === elementId) {
      return mutation.modified as TRecord
    }
  }

  return fallback()
}
