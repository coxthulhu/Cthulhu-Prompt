import { createTransaction } from '@tanstack/svelte-db'
import type { Collection } from '@tanstack/svelte-db'
import type {
  TanstackRevisionEnvelope,
  TanstackRevisionPayloadEntity
} from '@shared/tanstack/TanstackRevision'
import { ipcInvoke } from '@renderer/api/ipcInvoke'
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

type TanstackAnyRevisionCollection = Collection<
  any,
  string,
  TanstackRevisionCollectionUtils<any>
>

type TanstackRevisionCollectionsMap = Record<string, TanstackAnyRevisionCollection>

type TanstackCollectionRecord<TCollection> = TCollection extends Collection<infer TRecord, any, any>
  ? TRecord
  : never

type TanstackRevisionMutationPayload = Record<
  string,
  TanstackRevisionEnvelope<any>
>

type TanstackMutationRequest = {
  requestId: string
  payload: Record<string, unknown>
}

type TanstackRevisionMutationResult<TPayload extends TanstackRevisionMutationPayload> =
  | { success: true; payload: TPayload }
  | { success: false; conflict: true; payload: TPayload }
  | { success: false; error: string; conflict?: false }

const tanstackPayloadEntityCollectionSymbol = Symbol('tanstackPayloadEntityCollection')

type TanstackPayloadEntityWithCollectionMeta<TRecord extends object> = TanstackRevisionPayloadEntity<TRecord> & {
  [tanstackPayloadEntityCollectionSymbol]: TanstackAnyRevisionCollection
}

type TanstackRevisionPayloadEntityBuilders<TCollections extends TanstackRevisionCollectionsMap> = {
  [TCollectionKey in keyof TCollections]: (entity: {
    id: string
    data: TanstackCollectionRecord<TCollections[TCollectionKey]>
  }) => TanstackRevisionPayloadEntity<TanstackCollectionRecord<TCollections[TCollectionKey]>>
}

type TanstackRevisionMutationOptions<
  TCollections extends TanstackRevisionCollectionsMap,
  TPayload extends TanstackRevisionMutationPayload
> = {
  mutateOptimistically: () => void
  runMutation: (
    helpers: {
      entity: TanstackRevisionPayloadEntityBuilders<TCollections>
      invoke: <
        TResult extends TanstackRevisionMutationResult<TPayload>,
        TRequest extends TanstackMutationRequest
      >(
        channel: string,
        request: TRequest
      ) => Promise<TResult>
    }
  ) => Promise<TanstackRevisionMutationResult<TPayload>>
  conflictMessage: string
}

const createPayloadEntityBuilders = <TCollections extends TanstackRevisionCollectionsMap>(
  collections: TCollections
): TanstackRevisionPayloadEntityBuilders<TCollections> => {
  const builders = {} as TanstackRevisionPayloadEntityBuilders<TCollections>

  for (const collectionKey of Object.keys(collections) as Array<keyof TCollections>) {
    const collection = collections[collectionKey]

    builders[collectionKey] = ((entity) => {
      const payloadEntity: TanstackPayloadEntityWithCollectionMeta<
        TanstackCollectionRecord<TCollections[typeof collectionKey]>
      > = {
        id: entity.id,
        expectedRevision: collection.utils.getAuthoritativeRevision(entity.id),
        data: entity.data,
        [tanstackPayloadEntityCollectionSymbol]: collection
      }

      return payloadEntity
    }) as TanstackRevisionPayloadEntityBuilders<TCollections>[typeof collectionKey]
  }

  return builders
}

const sanitizeMutationPayload = (
  payload: Record<string, unknown>,
  payloadCollections: Map<string, TanstackAnyRevisionCollection>
): Record<string, unknown> => {
  const sanitized: Record<string, unknown> = {}

  for (const [payloadKey, value] of Object.entries(payload)) {
    if (
      !value ||
      typeof value !== 'object' ||
      !(tanstackPayloadEntityCollectionSymbol in value)
    ) {
      sanitized[payloadKey] = value
      continue
    }

    const payloadEntity = value as TanstackPayloadEntityWithCollectionMeta<any>
    payloadCollections.set(payloadKey, payloadEntity[tanstackPayloadEntityCollectionSymbol])
    sanitized[payloadKey] = {
      id: payloadEntity.id,
      expectedRevision: payloadEntity.expectedRevision,
      data: payloadEntity.data
    }
  }

  return sanitized
}

const mergeAuthoritativePayload = (
  payload: TanstackRevisionMutationPayload,
  payloadCollections: Map<string, TanstackAnyRevisionCollection>
): void => {
  for (const payloadKey of payloadCollections.keys()) {
    if (!(payloadKey in payload)) {
      throw new Error(`Missing mutation payload entity: ${payloadKey}`)
    }
  }

  for (const [payloadKey, snapshot] of Object.entries(payload)) {
    const collection = payloadCollections.get(payloadKey)

    if (!collection) {
      throw new Error(`Unknown mutation payload entity: ${payloadKey}`)
    }

    collection.utils.upsertAuthoritative(snapshot)
  }
}

const runTanstackRevisionMutationWithCollections = async <
  TCollections extends TanstackRevisionCollectionsMap,
  TPayload extends TanstackRevisionMutationPayload
>(
  collections: TCollections,
  {
  mutateOptimistically,
  runMutation,
  conflictMessage
}: TanstackRevisionMutationOptions<TCollections, TPayload>
): Promise<void> => {
  const payloadCollections = new Map<string, TanstackAnyRevisionCollection>()
  const entity = createPayloadEntityBuilders(collections)

  const transaction = createTransaction({
    autoCommit: false,
    mutationFn: async () => {
      const result = await runMutation({
        entity,
        invoke: async (channel, request) => {
          const payload = sanitizeMutationPayload(request.payload, payloadCollections)
          return ipcInvoke(channel, {
            ...request,
            payload
          })
        }
      })

      if ('payload' in result) {
        mergeAuthoritativePayload(result.payload, payloadCollections)
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

export const runTanstackRevisionMutation = <TCollections extends TanstackRevisionCollectionsMap>(
  collections: TCollections
) => {
  return async <TPayload extends TanstackRevisionMutationPayload>(
    options: TanstackRevisionMutationOptions<TCollections, TPayload>
  ): Promise<void> => {
    await runTanstackRevisionMutationWithCollections(collections, options)
  }
}
