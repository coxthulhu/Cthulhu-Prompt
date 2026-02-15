import { createTransaction } from '@tanstack/svelte-db'
import type { Collection } from '@tanstack/svelte-db'
import type { Transaction } from '@tanstack/svelte-db'
import type { RevisionPayloadEntity } from '@shared/Revision'
import type { IpcMutationPayloadResult } from '@shared/IpcResult'
import { ipcInvokeWithPayload } from './IpcInvoke'
import type { RevisionCollectionUtils } from '../Collections/RevisionCollection'
import {
  applyOptimisticMutation,
  collectTouchedElementsFromMutation,
  type OptimisticMutateFn,
  type OptimisticCollectionsMap,
  type TouchedElement
} from './RevisionMutationOptimisticHelpers'
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

type MutationRequest<TRevisionCollections extends RevisionCollectionsMap> = {
  payload: Partial<{
    [TCollectionKey in keyof TRevisionCollections]: RevisionPayloadEntity<
      CollectionRecord<TRevisionCollections[TCollectionKey]>
    >
  }>
}

type RevisionEntityBuilders<TRevisionCollections extends RevisionCollectionsMap> = {
  [TCollectionKey in keyof TRevisionCollections]: (entity: {
    id: string
    data: CollectionRecord<TRevisionCollections[TCollectionKey]>
  }) => RevisionPayloadEntity<CollectionRecord<TRevisionCollections[TCollectionKey]>>
}

type RevisionMutationOptions<
  TRevisionCollections extends RevisionCollectionsMap,
  TOptimisticCollections extends OptimisticCollectionsMap,
  TPayload
> = {
  mutateOptimistically: OptimisticMutateFn<TOptimisticCollections>
  persistMutations: (
    helpers: {
      entities: RevisionEntityBuilders<TRevisionCollections>
      invoke: <
        TRequest extends MutationRequest<TRevisionCollections> = MutationRequest<TRevisionCollections>
      >(
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
  TRevisionCollections extends RevisionCollectionsMap,
  TOptimisticCollections extends OptimisticCollectionsMap,
  TPayload
> = RevisionMutationOptions<TRevisionCollections, TOptimisticCollections, TPayload> & {
  collectionId: string
  elementId: string | number
  debounceMs: number
  validateBeforeEnqueue?: (transaction: Transaction<any>) => boolean
}

type CreateRevisionMutationTransactionOptions<
  TRevisionCollections extends RevisionCollectionsMap,
  TPayload
> = Pick<
  RevisionMutationOptions<TRevisionCollections, OptimisticCollectionsMap, TPayload>,
  'persistMutations' | 'handleSuccessOrConflictResponse' | 'conflictMessage'
>

// Create a manual-commit transaction using the shared revision mutation contract.
const createRevisionMutationTransaction = <
  TRevisionCollections extends RevisionCollectionsMap,
  TPayload
>(
  revisionCollections: TRevisionCollections,
  { persistMutations, handleSuccessOrConflictResponse, conflictMessage }: CreateRevisionMutationTransactionOptions<
    TRevisionCollections,
    TPayload
  >
): Transaction<any> => {
  const entities = {} as RevisionEntityBuilders<TRevisionCollections>

  for (const collectionKey of Object.keys(revisionCollections) as Array<
    keyof TRevisionCollections
  >) {
    const collection = revisionCollections[collectionKey]

    entities[collectionKey] = ((entity) => {
      return {
        id: entity.id,
        expectedRevision: collection.utils.getAuthoritativeRevision(entity.id),
        data: entity.data
      }
    }) as RevisionEntityBuilders<TRevisionCollections>[typeof collectionKey]
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

// Keep optimistic mutation replay on one collect-then-apply path for all runners.
const collectAndApplyOptimisticMutationToTransaction = <
  TOptimisticCollections extends OptimisticCollectionsMap
>(
  transaction: Transaction<any>,
  optimisticCollections: TOptimisticCollections,
  mutateOptimistically: OptimisticMutateFn<TOptimisticCollections>,
  beforeApply?: (touchedElements: Array<TouchedElement>) => void
): Array<TouchedElement> => {
  const touchedElements = collectTouchedElementsFromMutation(
    optimisticCollections,
    mutateOptimistically
  )
  beforeApply?.(touchedElements)
  mutateRevisionTransaction(transaction, () => {
    applyOptimisticMutation(optimisticCollections, mutateOptimistically)
  })
  return touchedElements
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
  TRevisionCollections extends RevisionCollectionsMap,
  TOptimisticCollections extends OptimisticCollectionsMap
>(
  revisionCollections: TRevisionCollections,
  optimisticCollections: TOptimisticCollections
) => {
  return async <TPayload>(
    options: RevisionMutationOptions<
      TRevisionCollections,
      TOptimisticCollections,
      TPayload
    >
  ): Promise<void> => {
    const { onSuccess, queueImmediately = true } = options
    const transaction = createRevisionMutationTransaction<TRevisionCollections, TPayload>(
      revisionCollections,
      options
    )

    collectAndApplyOptimisticMutationToTransaction(
      transaction,
      optimisticCollections,
      options.mutateOptimistically,
      queueImmediately
        ? (touchedElements) => {
            // Flush matching open updates before applying immediate optimistic changes.
            for (const touchedElement of touchedElements) {
              sendOpenUpdateTransactionIfPresent(
                touchedElement.collectionId,
                touchedElement.elementId,
                'before-immediate-transaction'
              )
            }
          }
        : undefined
    )

    if (!queueImmediately) {
      return
    }

    await enqueueRevisionMutationTransaction(transaction, onSuccess)
  }
}

// Public runner for debounced per-element open update transactions.
export const createOpenRevisionUpdateMutationRunner = <
  TRevisionCollections extends RevisionCollectionsMap,
  TOptimisticCollections extends OptimisticCollectionsMap
>(
  revisionCollections: TRevisionCollections,
  optimisticCollections: TOptimisticCollections
) => {
  return <TPayload>(
    options: OpenRevisionUpdateMutationOptions<
      TRevisionCollections,
      TOptimisticCollections,
      TPayload
    >
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
        const transaction = createRevisionMutationTransaction<TRevisionCollections, TPayload>(
          revisionCollections,
          options
        )

        return {
          transaction,
          validateBeforeEnqueue,
          enqueueTransaction: async () => {
            await enqueueRevisionMutationTransaction(transaction, onSuccess)
          }
        }
      },
      mutateTransaction: (transaction) => {
        collectAndApplyOptimisticMutationToTransaction(
          transaction,
          optimisticCollections,
          mutateOptimistically
        )
      }
    })
  }
}
