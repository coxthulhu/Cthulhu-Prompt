import { createTransaction } from '@tanstack/svelte-db'
import type { Collection } from '@tanstack/svelte-db'
import type { Transaction } from '@tanstack/svelte-db'
import type { RevisionPayloadEntity } from '@shared/Revision'
import type { IpcMutationPayloadResult } from '@shared/IpcResult'
import { ipcInvokeWithPayload } from './IpcInvoke'
import type { RevisionCollectionUtils } from '../Collections/RevisionCollection'
import {
  clearRevisionMutationTransaction,
  mutateOpenUpdateTransaction,
  registerRevisionMutationTransaction,
  sendOpenUpdateTransactionIfPresent,
  syncRevisionMutationTransactionIndex
} from './RevisionMutationTransactionRegistry'
import type { TransactionEntry } from './RevisionMutationTransactionRegistry'

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
}

type CreateRevisionMutationTransactionOptions<
  TCollections extends RevisionCollectionsMap,
  TPayload
> = Pick<
  RevisionMutationOptions<TCollections, TPayload>,
  'persistMutations' | 'handleSuccessOrConflictResponse' | 'conflictMessage'
>

// Create and register a manual-commit transaction using the shared revision mutation contract.
const createRegisteredRevisionMutationTransaction = <
  TCollections extends RevisionCollectionsMap,
  TPayload
>(
  collections: TCollections,
  {
    persistMutations,
    handleSuccessOrConflictResponse,
    conflictMessage
  }: CreateRevisionMutationTransactionOptions<TCollections, TPayload>,
  queuedImmediately: boolean
): TransactionEntry => {
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

  return registerRevisionMutationTransaction(transaction, queuedImmediately)
}

// Apply optimistic mutation logic and refresh element indexes for the transaction.
const mutateRevisionTransaction = (
  transaction: Transaction<any>,
  mutateOptimistically: () => void
): void => {
  transaction.mutate(mutateOptimistically)
  syncRevisionMutationTransactionIndex(transaction.id)
}

// Side effect: always remove transaction registry entries once enqueue work settles.
const enqueueAndClearRegisteredRevisionMutationTransaction = async (
  transactionEntry: TransactionEntry,
  onSuccess: (() => void) | undefined
): Promise<void> => {
  try {
    await enqueueGlobalMutation(async () => {
      if (transactionEntry.transaction.state === 'pending') {
        await transactionEntry.transaction.commit()
      }

      if (transactionEntry.transaction.state === 'completed') {
        // Side effect: success hook runs only after transaction commit succeeds.
        onSuccess?.()
      }
    })
  } finally {
    clearRevisionMutationTransaction(transactionEntry.transaction.id)
  }
}

// Public runner for standard revision mutations (immediate queueing by default).
export const createRevisionMutationRunner = <
  TCollections extends RevisionCollectionsMap
>(
  collections: TCollections
) => {
  return async <TPayload>(
    {
      mutateOptimistically,
      persistMutations,
      handleSuccessOrConflictResponse,
      conflictMessage,
      onSuccess,
      queueImmediately = true
    }: RevisionMutationOptions<TCollections, TPayload>
  ): Promise<void> => {
    const transactionEntry = createRegisteredRevisionMutationTransaction(
      collections,
      {
        persistMutations,
        handleSuccessOrConflictResponse,
        conflictMessage
      },
      queueImmediately
    )

    try {
      mutateRevisionTransaction(transactionEntry.transaction, mutateOptimistically)
    } catch (error) {
      clearRevisionMutationTransaction(transactionEntry.transaction.id)
      throw error
    }

    if (!queueImmediately) {
      return
    }

    // Flush any open debounced updates for elements touched by this immediate transaction.
    const sentElementKeys = new Set<string>()
    for (const mutation of transactionEntry.transaction.mutations) {
      const collectionId = mutation.collection.id
      const elementId = mutation.key as string | number
      const elementKey = `${collectionId}/${elementId}`

      if (sentElementKeys.has(elementKey)) {
        continue
      }

      sentElementKeys.add(elementKey)
      sendOpenUpdateTransactionIfPresent(collectionId, elementId)
    }

    await enqueueAndClearRegisteredRevisionMutationTransaction(transactionEntry, onSuccess)
  }
}

// Public runner for debounced per-element open update transactions.
export const createOpenRevisionUpdateMutationRunner = <
  TCollections extends RevisionCollectionsMap
>(
  collections: TCollections
) => {
  return <TPayload>(
    {
      collectionId,
      elementId,
      debounceMs,
      mutateOptimistically,
      persistMutations,
      handleSuccessOrConflictResponse,
      conflictMessage,
      onSuccess
    }: OpenRevisionUpdateMutationOptions<TCollections, TPayload>
  ): void => {
    mutateOpenUpdateTransaction({
      collectionId,
      elementId,
      debounceMs,
      createTransaction: () => {
        const transactionEntry = createRegisteredRevisionMutationTransaction(
          collections,
          {
            persistMutations,
            handleSuccessOrConflictResponse,
            conflictMessage
          },
          false
        )

        return {
          transactionEntry,
          enqueueTransaction: async () => {
            await enqueueAndClearRegisteredRevisionMutationTransaction(transactionEntry, onSuccess)
          }
        }
      },
      mutateTransaction: (transaction) => {
        mutateRevisionTransaction(transaction, mutateOptimistically)
      }
    })
  }
}
