import { createTransaction } from '@tanstack/svelte-db'
import type { Collection } from '@tanstack/svelte-db'
import type { RevisionPayloadEntity } from '@shared/Revision'
import { ipcInvokeWithPayload } from './IpcInvoke'
import type { RevisionCollectionUtils } from '../Collections/RevisionCollection'

type QueuedTask<T> = () => Promise<T>
let mutationQueue: Promise<void> = Promise.resolve()

const enqueueGlobalMutation = <T>(task: QueuedTask<T>): Promise<T> => {
  const queuedTask = mutationQueue.then(task)
  mutationQueue = queuedTask.then(
    () => undefined,
    () => undefined
  )
  return queuedTask
}

type AnyRevisionCollection = Collection<
  any,
  string,
  RevisionCollectionUtils<any>
>

type RevisionCollectionsMap = Record<string, AnyRevisionCollection>

type CollectionRecord<TCollection> = TCollection extends Collection<
  infer TRecord,
  string,
  infer _TUtils
>
  ? TRecord
  : never

type MutationRequest<TCollections extends RevisionCollectionsMap> = {
  payload: Partial<{
    [TCollectionKey in keyof TCollections]: RevisionPayloadEntity<
      CollectionRecord<TCollections[TCollectionKey]>
    >
  }>
}

type RevisionMutationResult<TPayload> =
  | { success: true; payload: TPayload }
  | { success: false; conflict: true; payload: TPayload }
  | { success: false; error: string; conflict?: false }

type RevisionEntityBuilders<TCollections extends RevisionCollectionsMap> = {
  [TCollectionKey in keyof TCollections]: (entity: {
    id: string
    data: CollectionRecord<TCollections[TCollectionKey]>
  }) => RevisionPayloadEntity<CollectionRecord<TCollections[TCollectionKey]>>
}

type RevisionMutationOptions<
  TCollections extends RevisionCollectionsMap,
  TPayload
> = {
  mutateOptimistically: () => void
  persistMutations: (
    helpers: {
      entities: RevisionEntityBuilders<TCollections>
      invoke: <TRequest extends MutationRequest<TCollections> = MutationRequest<TCollections>>(
        channel: string,
        request: TRequest
      ) => Promise<RevisionMutationResult<TPayload>>
    }
  ) => Promise<RevisionMutationResult<TPayload>>
  handleSuccessOrConflictResponse: (payload: TPayload) => void
  conflictMessage: string
  onSuccess?: () => void
}

const createRevisionEntityBuilders = <TCollections extends RevisionCollectionsMap>(
  collections: TCollections
): RevisionEntityBuilders<TCollections> => {
  const builders = {} as RevisionEntityBuilders<TCollections>

  for (const collectionKey of Object.keys(collections) as Array<keyof TCollections>) {
    const collection = collections[collectionKey]

    builders[collectionKey] = ((entity) => {
      return {
        id: entity.id,
        expectedRevision: collection.utils.getAuthoritativeRevision(entity.id),
        data: entity.data
      }
    }) as RevisionEntityBuilders<TCollections>[typeof collectionKey]
  }

  return builders
}

const runRevisionMutation = async <
  TCollections extends RevisionCollectionsMap,
  TPayload
>(
  collections: TCollections,
  {
    mutateOptimistically,
    persistMutations,
    handleSuccessOrConflictResponse,
    conflictMessage,
    onSuccess
  }: RevisionMutationOptions<TCollections, TPayload>
): Promise<void> => {
  const entities = createRevisionEntityBuilders(collections)

  const transaction = createTransaction({
    autoCommit: false,
    mutationFn: async () => {
      const mutationResult = await persistMutations({
        entities,
        invoke: (channel, request) => ipcInvokeWithPayload(channel, request.payload)
      })

      if ('payload' in mutationResult) {
        handleSuccessOrConflictResponse(mutationResult.payload)
      }

      if (mutationResult.success) {
        return
      }

      if (mutationResult.conflict) {
        throw new Error(conflictMessage)
      }

      throw new Error(mutationResult.error)
    }
  })

  transaction.mutate(mutateOptimistically)

  await enqueueGlobalMutation(async () => {
    if (transaction.state === 'pending') {
      await transaction.commit()
    }

    if (transaction.state === 'completed') {
      // Side effect: success hook runs only after transaction commit succeeds.
      onSuccess?.()
    }
  })
}

export const createRevisionMutationRunner = <
  TCollections extends RevisionCollectionsMap
>(
  collections: TCollections
) => {
  return async <TPayload>(
    options: RevisionMutationOptions<TCollections, TPayload>
  ): Promise<void> => {
    await runRevisionMutation(collections, options)
  }
}
