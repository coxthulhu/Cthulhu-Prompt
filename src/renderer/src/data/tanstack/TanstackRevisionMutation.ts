import { createTransaction } from '@tanstack/svelte-db'
import type { Collection } from '@tanstack/svelte-db'
import type { TanstackRevisionEnvelope } from '@shared/tanstack/TanstackRevision'
import type { TanstackRevisionCollectionUtils } from './TanstackRevisionCollection'

type TanstackQueuedTask<T> = () => Promise<T>
let tanstackMutationQueue: Promise<void> = Promise.resolve()

const enqueueTanstackGlobalMutation = <T>(task: TanstackQueuedTask<T>): Promise<T> => {
  const queuedTask = tanstackMutationQueue.then(task)
  tanstackMutationQueue = queuedTask.then(
    () => undefined,
    () => undefined
  )
  return queuedTask
}

type TanstackRevisionMutationResult<TKey extends string | number, TRecord> =
  | { success: true; payload: TanstackRevisionEnvelope<TKey, TRecord> }
  | { success: false; conflict: true; payload: TanstackRevisionEnvelope<TKey, TRecord> }
  | { success: false; error: string; conflict?: false }

type TanstackRevisionMutationOptions<TRecord extends object, TKey extends string | number> = {
  collection: Collection<TRecord, TKey, TanstackRevisionCollectionUtils<TRecord, TKey>>
  key: TKey
  mutateOptimistically: () => void
  runMutation: (
    expectedRevision: number
  ) => Promise<TanstackRevisionMutationResult<TKey, TRecord>>
  conflictMessage: string
}

export const runTanstackRevisionMutation = async <TRecord extends object, TKey extends string | number>({
  collection,
  key,
  mutateOptimistically,
  runMutation,
  conflictMessage
}: TanstackRevisionMutationOptions<TRecord, TKey>): Promise<void> => {
  const transaction = createTransaction<TRecord>({
    autoCommit: false,
    mutationFn: async () => {
      const result = await runMutation(collection.utils.getAuthoritativeRevision(key))

      if ('payload' in result) {
        collection.utils.upsertAuthoritative(result.payload)
      }

      if (result.success) {
        return
      }

      if (result.conflict) {
        throw new Error(conflictMessage)
      }

      throw new Error(result.error)
    }
  })

  transaction.mutate(mutateOptimistically)

  await enqueueTanstackGlobalMutation(async () => {
    if (transaction.state === 'pending') {
      await transaction.commit()
    }
  })
}
