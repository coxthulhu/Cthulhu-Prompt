import { createTransaction } from '@tanstack/svelte-db'

type TanstackQueuedTask<T> = () => Promise<T>
let tanstackMutationQueue: Promise<void> = Promise.resolve()

const enqueueTanstackGlobalMutation = <T>(task: TanstackQueuedTask<T>): Promise<T> => {
  const run = tanstackMutationQueue.then(task)
  tanstackMutationQueue = run.then(
    () => undefined,
    () => undefined
  )
  return run
}

type TanstackRevisionMutationResult<TPayload> =
  | { success: true; payload: TPayload }
  | { success: false; conflict: true; payload: TPayload }
  | { success: false; error: string; conflict?: false }

type TanstackRevisionMutationOptions<TPayload> = {
  getExpectedRevision: () => number
  mutateOptimistically: () => void
  runMutation: (expectedRevision: number) => Promise<TanstackRevisionMutationResult<TPayload>>
  applyAuthoritative: (payload: TPayload) => void
  conflictMessage: string
}

export const runTanstackRevisionMutation = async <TRecord extends object, TPayload>({
  getExpectedRevision,
  mutateOptimistically,
  runMutation,
  applyAuthoritative,
  conflictMessage
}: TanstackRevisionMutationOptions<TPayload>): Promise<TPayload> => {
  let committedPayload: TPayload | null = null

  const transaction = createTransaction<TRecord>({
    autoCommit: false,
    mutationFn: async () => {
      const result = await runMutation(getExpectedRevision())

      if (result.success) {
        committedPayload = result.payload
        applyAuthoritative(result.payload)
        return
      }

      if (result.conflict) {
        applyAuthoritative(result.payload)
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

  if (!committedPayload) {
    throw new Error('TanStack revision mutation did not commit')
  }

  return committedPayload
}
