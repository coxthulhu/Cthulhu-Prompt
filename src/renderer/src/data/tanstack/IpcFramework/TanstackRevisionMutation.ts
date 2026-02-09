import { createTransaction } from '@tanstack/svelte-db'
import type { Collection } from '@tanstack/svelte-db'
import type { TanstackRevisionPayloadEntity } from '@shared/tanstack/TanstackRevision'
import { tanstackIpcInvokeWithPayload } from './TanstackIpcInvoke'
import type { TanstackRevisionCollectionUtils } from '../Collections/TanstackRevisionCollection'

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

type TanstackAnyRevisionCollection = Collection<
  any,
  string,
  TanstackRevisionCollectionUtils<any>
>

type TanstackRevisionCollectionsMap = Record<string, TanstackAnyRevisionCollection>

type TanstackCollectionRecord<TCollection> = TCollection extends Collection<
  infer TRecord,
  string,
  infer _TUtils
>
  ? TRecord
  : never

type TanstackMutationRequest<TCollections extends TanstackRevisionCollectionsMap> = {
  payload: Partial<{
    [TCollectionKey in keyof TCollections]: TanstackRevisionPayloadEntity<
      TanstackCollectionRecord<TCollections[TCollectionKey]>
    >
  }>
}

type TanstackRevisionMutationResult<TPayload> =
  | { success: true; payload: TPayload }
  | { success: false; conflict: true; payload: TPayload }
  | { success: false; error: string; conflict?: false }

type TanstackRevisionEntityBuilders<TCollections extends TanstackRevisionCollectionsMap> = {
  [TCollectionKey in keyof TCollections]: (entity: {
    id: string
    data: TanstackCollectionRecord<TCollections[TCollectionKey]>
  }) => TanstackRevisionPayloadEntity<TanstackCollectionRecord<TCollections[TCollectionKey]>>
}

type TanstackRevisionMutationOptions<
  TCollections extends TanstackRevisionCollectionsMap,
  TPayload
> = {
  mutateOptimistically: () => void
  runMutation: (
    helpers: {
      entities: TanstackRevisionEntityBuilders<TCollections>
      invoke: <
        TResult extends TanstackRevisionMutationResult<TPayload>,
        TRequest extends TanstackMutationRequest<TCollections>
      >(
        channel: string,
        request: TRequest
      ) => Promise<TResult>
    }
  ) => Promise<TanstackRevisionMutationResult<TPayload>>
  handleSuccessOrConflictResponse: (payload: TPayload) => void
  conflictMessage: string
}

const createRevisionEntityBuilders = <TCollections extends TanstackRevisionCollectionsMap>(
  collections: TCollections
): TanstackRevisionEntityBuilders<TCollections> => {
  const builders = {} as TanstackRevisionEntityBuilders<TCollections>

  for (const collectionKey of Object.keys(collections) as Array<keyof TCollections>) {
    const collection = collections[collectionKey]

    builders[collectionKey] = ((entity) => {
      return {
        id: entity.id,
        expectedRevision: collection.utils.getAuthoritativeRevision(entity.id),
        data: entity.data
      }
    }) as TanstackRevisionEntityBuilders<TCollections>[typeof collectionKey]
  }

  return builders
}

const runRevisionMutation = async <
  TCollections extends TanstackRevisionCollectionsMap,
  TPayload
>(
  collections: TCollections,
  {
    mutateOptimistically,
    runMutation,
    handleSuccessOrConflictResponse,
    conflictMessage
  }: TanstackRevisionMutationOptions<TCollections, TPayload>
): Promise<void> => {
  const entities = createRevisionEntityBuilders(collections)

  const transaction = createTransaction({
    autoCommit: false,
    mutationFn: async () => {
      const mutationResult = await runMutation({
        entities,
        invoke: (channel, request) => tanstackIpcInvokeWithPayload(channel, request.payload)
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

  await enqueueTanstackGlobalMutation(async () => {
    if (transaction.state === 'pending') {
      await transaction.commit()
    }
  })
}

export const createTanstackRevisionMutationRunner = <
  TCollections extends TanstackRevisionCollectionsMap
>(
  collections: TCollections
) => {
  return async <TPayload>(
    options: TanstackRevisionMutationOptions<TCollections, TPayload>
  ): Promise<void> => {
    await runRevisionMutation(collections, options)
  }
}
