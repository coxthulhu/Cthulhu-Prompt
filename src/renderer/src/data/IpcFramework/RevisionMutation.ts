import { createTransaction } from '@tanstack/svelte-db'
import type { Collection } from '@tanstack/svelte-db'
import type { Transaction } from '@tanstack/svelte-db'
import type { RevisionPayloadEntity } from '@shared/Revision'
import type { IpcMutationPayloadResult } from '@shared/IpcResult'
import { ipcInvokeWithPayload } from './IpcInvoke'
import type { RevisionCollectionUtils } from '../Collections/RevisionCollection'
import {
  mutateOpenUpdateTransaction,
  sendOpenUpdateTransactionIfPresent
} from './RevisionMutationTransactionRegistry'

type QueuedTask<T> = () => Promise<T>
let mutationQueue: Promise<void> = Promise.resolve()

// Side effect: serialize all mutation commits through a single queue.
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
      ) => Promise<IpcMutationPayloadResult<TPayload>>
      transaction: Transaction<any>
    }
  ) => Promise<IpcMutationPayloadResult<TPayload>>
  handleSuccessOrConflictResponse: (payload: TPayload) => void
  conflictMessage: string
  onSuccess?: () => void
  queueImmediately?: boolean
}

type OpenRevisionUpdateMutationOptions<
  TCollections extends RevisionCollectionsMap,
  TPayload
> = RevisionMutationOptions<TCollections, TPayload> & {
  collectionId: string
  elementId: string | number
  debounceMs: number
  validateBeforeEnqueue?: (transaction: Transaction<any>) => boolean
}

type CreateRevisionMutationTransactionOptions<
  TCollections extends RevisionCollectionsMap,
  TPayload
> = Pick<
  RevisionMutationOptions<TCollections, TPayload>,
  'persistMutations' | 'handleSuccessOrConflictResponse' | 'conflictMessage'
>

// Create a manual-commit transaction using the shared revision mutation contract.
const createRevisionMutationTransaction = <
  TCollections extends RevisionCollectionsMap,
  TPayload
>(
  collections: TCollections,
  {
    persistMutations,
    handleSuccessOrConflictResponse,
    conflictMessage
  }: CreateRevisionMutationTransactionOptions<TCollections, TPayload>
): Transaction<any> => {
  const entities = {} as RevisionEntityBuilders<TCollections>

  for (const collectionKey of Object.keys(collections) as Array<keyof TCollections>) {
    const collection = collections[collectionKey]

    entities[collectionKey] = ((entity) => {
      return {
        id: entity.id,
        expectedRevision: collection.utils.getAuthoritativeRevision(entity.id),
        data: entity.data
      }
    }) as RevisionEntityBuilders<TCollections>[typeof collectionKey]
  }

  const transaction = createTransaction({
    autoCommit: false,
    mutationFn: async ({ transaction }) => {
      const mutationResult = await persistMutations({
        entities,
        invoke: (channel, request) => ipcInvokeWithPayload(channel, request.payload),
        transaction
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

  return transaction
}

// Apply optimistic mutation logic for a transaction.
const mutateRevisionTransaction = (
  transaction: Transaction<any>,
  mutateOptimistically: () => void
): void => {
  transaction.mutate(mutateOptimistically)
}

// Side effect: enqueue one transaction and run success hook when it commits.
const enqueueRevisionMutationTransaction = async (
  transaction: Transaction<any>,
  onSuccess: (() => void) | undefined
): Promise<void> => {
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

// Public runner for standard revision mutations (immediate queueing by default).
export const createRevisionMutationRunner = <
  TCollections extends RevisionCollectionsMap
>(
  collections: TCollections
) => {
  return async <TPayload>(
    options: RevisionMutationOptions<TCollections, TPayload>
  ): Promise<void> => {
    const { onSuccess, queueImmediately = true } = options
    const transaction = createRevisionMutationTransaction(collections, options)

    mutateRevisionTransaction(transaction, options.mutateOptimistically)

    if (!queueImmediately) {
      return
    }

    // Flush any open debounced updates for elements touched by this immediate transaction.
    const sentElementKeys = new Set<string>()
    for (const mutation of transaction.mutations) {
      const collectionId = mutation.collection.id
      const elementId = mutation.key as string | number
      const elementKey = `${collectionId}/${elementId}`

      if (sentElementKeys.has(elementKey)) {
        continue
      }

      sentElementKeys.add(elementKey)
      sendOpenUpdateTransactionIfPresent(
        collectionId,
        elementId,
        'before-immediate-transaction'
      )
    }

    await enqueueRevisionMutationTransaction(transaction, onSuccess)
  }
}

// Public runner for debounced per-element open update transactions.
export const createOpenRevisionUpdateMutationRunner = <
  TCollections extends RevisionCollectionsMap
>(
  collections: TCollections
) => {
  return <TPayload>(
    options: OpenRevisionUpdateMutationOptions<TCollections, TPayload>
  ): void => {
    const {
      collectionId,
      elementId,
      debounceMs,
      validateBeforeEnqueue,
      mutateOptimistically,
      onSuccess
    } = options

    mutateOpenUpdateTransaction({
      collectionId,
      elementId,
      debounceMs,
      createTransaction: () => {
        const transaction = createRevisionMutationTransaction(collections, options)

        return {
          transaction,
          validateBeforeEnqueue,
          enqueueTransaction: async () => {
            await enqueueRevisionMutationTransaction(transaction, onSuccess)
          }
        }
      },
      mutateTransaction: (transaction) => {
        mutateRevisionTransaction(transaction, mutateOptimistically)
      }
    })
  }
}
