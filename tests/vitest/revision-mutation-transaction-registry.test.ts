import { createCollection } from '@tanstack/svelte-db'
import type { RevisionEnvelope } from '@shared/Revision'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { revisionCollectionOptions } from '@renderer/data/Collections/RevisionCollection'
import {
  createOpenRevisionUpdateMutationRunner,
  createRevisionMutationRunner
} from '@renderer/data/IpcFramework/RevisionMutation'
import {
  getTransactionsForElement,
  sendOpenUpdateTransactionIfPresent,
  submitOpenUpdateTransactionAndWait,
  submitAllOpenUpdateTransactionsAndWait
} from '@renderer/data/IpcFramework/RevisionMutationTransactionRegistry'

type TestRecord = {
  id: string
  value: number
}

type MutationPayload = {
  ok: true
}

const TEST_ITEM_ID = 'item-1'

let collectionCounter = 0

const nextCollectionId = (label: string): string => {
  collectionCounter += 1
  return `revision-mutation-registry-${label}-${collectionCounter}`
}

const createSingleItemRevisionEnvelope = (): RevisionEnvelope<TestRecord> => {
  return {
    id: TEST_ITEM_ID,
    revision: 1,
    data: { id: TEST_ITEM_ID, value: 0 }
  }
}

const createTestCollection = (
  collectionId: string,
  initialData: Array<RevisionEnvelope<TestRecord>>
) => {
  return createCollection(
    revisionCollectionOptions<TestRecord>({
      id: collectionId,
      getKey: (record) => record.id,
      initialData
    })
  )
}

const createSingleItemRegistryContext = (label: string) => {
  const collectionId = nextCollectionId(label)
  const collection = createTestCollection(collectionId, [createSingleItemRevisionEnvelope()])
  const indexedTransactions = getTransactionsForElement(collectionId, TEST_ITEM_ID)

  return {
    collectionId,
    collection,
    indexedTransactions
  }
}

describe('revision mutation transaction registry', () => {
  afterEach(async () => {
    await submitAllOpenUpdateTransactionsAndWait()
    vi.useRealTimers()
  })

  it('indexes by element with dedupe and marks queued transactions', async () => {
    const { collection, indexedTransactions } = createSingleItemRegistryContext('dedupe')
    const runMutation = createRevisionMutationRunner({ test: collection })
    let isQueuedImmediately: boolean | null = null

    await runMutation<MutationPayload>({
      mutateOptimistically: () => {
        collection.update(TEST_ITEM_ID, (draft) => {
          draft.value = 1
        })
        collection.update(TEST_ITEM_ID, (draft) => {
          draft.value = 2
        })
      },
      persistMutations: async () => {
        expect(indexedTransactions.size).toBe(1)
        const [entry] = [...indexedTransactions]
        isQueuedImmediately = entry?.isQueuedImmediately ?? null
        return { success: true, payload: { ok: true } }
      },
      handleSuccessOrConflictResponse: () => {},
      conflictMessage: 'Conflict'
    })

    expect(isQueuedImmediately).toBe(true)
    expect(indexedTransactions.size).toBe(0)
  })

  it('clears entries when persistence fails', async () => {
    const { collection, indexedTransactions } = createSingleItemRegistryContext('failure')
    const runMutation = createRevisionMutationRunner({ test: collection })

    await expect(
      runMutation<MutationPayload>({
        mutateOptimistically: () => {
          collection.update(TEST_ITEM_ID, (draft) => {
            draft.value = 3
          })
        },
        persistMutations: async () => ({
          success: false,
          conflict: true,
          payload: { ok: true }
        }),
        handleSuccessOrConflictResponse: () => {},
        conflictMessage: 'Conflict detected'
      })
    ).rejects.toThrow('Conflict detected')

    expect(indexedTransactions.size).toBe(0)
  })

  it('clears entries when mutateOptimistically throws', async () => {
    const { collection, indexedTransactions } =
      createSingleItemRegistryContext('optimistic-error')
    const runMutation = createRevisionMutationRunner({ test: collection })
    let persistCalled = false

    await expect(
      runMutation<MutationPayload>({
        mutateOptimistically: () => {
          collection.update(TEST_ITEM_ID, (draft) => {
            draft.value = 4
          })
          throw new Error('Optimistic mutation failed')
        },
        persistMutations: async () => {
          persistCalled = true
          return { success: true, payload: { ok: true } }
        },
        handleSuccessOrConflictResponse: () => {},
        conflictMessage: 'Conflict'
      })
    ).rejects.toThrow('Optimistic mutation failed')

    expect(persistCalled).toBe(false)
    expect(indexedTransactions.size).toBe(0)
  })

  it('does not keep index entries after insert-delete cancellation', async () => {
    const collectionId = nextCollectionId('cancel')
    const collection = createTestCollection(collectionId, [])
    const runMutation = createRevisionMutationRunner({ test: collection })
    const indexedTransactions = getTransactionsForElement(collectionId, 'item-new')
    let persistCalled = false

    await runMutation<MutationPayload>({
      mutateOptimistically: () => {
        collection.insert({
          id: 'item-new',
          value: 1
        })
        collection.delete('item-new')
      },
      persistMutations: async () => {
        persistCalled = true
        return { success: true, payload: { ok: true } }
      },
      handleSuccessOrConflictResponse: () => {},
      conflictMessage: 'Conflict'
    })

    expect(persistCalled).toBe(false)
    expect(indexedTransactions.size).toBe(0)
  })

  it('debounces open update transactions and enqueues only once', async () => {
    vi.useFakeTimers()

    const { collectionId, collection, indexedTransactions } =
      createSingleItemRegistryContext('open-debounce')
    const mutateOpenUpdate = createOpenRevisionUpdateMutationRunner({
      test: collection
    })
    let persistCalled = 0
    let isQueuedImmediately: boolean | null = null

    const queueOpenUpdateWithValue = (value: number) => {
      mutateOpenUpdate<MutationPayload>({
        collectionId,
        elementId: TEST_ITEM_ID,
        debounceMs: 200,
        mutateOptimistically: () => {
          collection.update(TEST_ITEM_ID, (draft) => {
            draft.value = value
          })
        },
        persistMutations: async () => {
          persistCalled += 1
          const [entry] = [...indexedTransactions]
          isQueuedImmediately = entry?.isQueuedImmediately ?? null
          return { success: true, payload: { ok: true } }
        },
        handleSuccessOrConflictResponse: () => {},
        conflictMessage: 'Conflict'
      })
    }

    queueOpenUpdateWithValue(1)
    queueOpenUpdateWithValue(2)

    expect(indexedTransactions.size).toBe(1)

    vi.advanceTimersByTime(199)
    await Promise.resolve()
    expect(persistCalled).toBe(0)

    vi.advanceTimersByTime(1)
    await submitAllOpenUpdateTransactionsAndWait()

    expect(persistCalled).toBe(1)
    expect(isQueuedImmediately).toBe(false)
    expect(indexedTransactions.size).toBe(0)
  })

  it('sends open update transactions immediately when requested', async () => {
    vi.useFakeTimers()

    const { collectionId, collection, indexedTransactions } =
      createSingleItemRegistryContext('open-send-now')
    const mutateOpenUpdate = createOpenRevisionUpdateMutationRunner({
      test: collection
    })
    let persistCalled = 0

    mutateOpenUpdate<MutationPayload>({
      collectionId,
      elementId: TEST_ITEM_ID,
      debounceMs: 10_000,
      mutateOptimistically: () => {
        collection.update(TEST_ITEM_ID, (draft) => {
          draft.value = 7
        })
      },
      persistMutations: async () => {
        persistCalled += 1
        return { success: true, payload: { ok: true } }
      },
      handleSuccessOrConflictResponse: () => {},
      conflictMessage: 'Conflict'
    })

    sendOpenUpdateTransactionIfPresent(collectionId, TEST_ITEM_ID)
    await submitAllOpenUpdateTransactionsAndWait()

    expect(persistCalled).toBe(1)
    expect(indexedTransactions.size).toBe(0)

    vi.advanceTimersByTime(10_000)
    await submitAllOpenUpdateTransactionsAndWait()
    expect(persistCalled).toBe(1)
  })

  it('waits for the targeted open update transaction when it is already in flight', async () => {
    const { collectionId, collection } = createSingleItemRegistryContext(
      'open-submit-targeted-in-flight'
    )
    const mutateOpenUpdate = createOpenRevisionUpdateMutationRunner({
      test: collection
    })
    let resolvePersist: (() => void) | null = null
    const persistGate = new Promise<void>((resolve) => {
      resolvePersist = resolve
    })
    let persistFinished = false

    mutateOpenUpdate<MutationPayload>({
      collectionId,
      elementId: TEST_ITEM_ID,
      debounceMs: 10_000,
      mutateOptimistically: () => {
        collection.update(TEST_ITEM_ID, (draft) => {
          draft.value = 9
        })
      },
      persistMutations: async () => {
        await persistGate
        persistFinished = true
        return { success: true, payload: { ok: true } }
      },
      handleSuccessOrConflictResponse: () => {},
      conflictMessage: 'Conflict'
    })

    sendOpenUpdateTransactionIfPresent(collectionId, TEST_ITEM_ID)
    const waitTask = submitOpenUpdateTransactionAndWait(collectionId, TEST_ITEM_ID)

    await Promise.resolve()
    expect(persistFinished).toBe(false)

    resolvePersist!()
    await waitTask

    expect(persistFinished).toBe(true)
  })

  it('keeps invalid debounced open update transactions pending until validation passes', async () => {
    vi.useFakeTimers()

    const { collectionId, collection, indexedTransactions } =
      createSingleItemRegistryContext('open-validation-debounce')
    const mutateOpenUpdate = createOpenRevisionUpdateMutationRunner({
      test: collection
    })
    let persistCalled = 0
    let isValid = false

    mutateOpenUpdate<MutationPayload>({
      collectionId,
      elementId: TEST_ITEM_ID,
      debounceMs: 200,
      validateBeforeEnqueue: () => isValid,
      mutateOptimistically: () => {
        collection.update(TEST_ITEM_ID, (draft) => {
          draft.value = 1
        })
      },
      persistMutations: async () => {
        persistCalled += 1
        return { success: true, payload: { ok: true } }
      },
      handleSuccessOrConflictResponse: () => {},
      conflictMessage: 'Conflict'
    })

    vi.advanceTimersByTime(200)
    await submitAllOpenUpdateTransactionsAndWait()

    expect(persistCalled).toBe(0)
    expect(indexedTransactions.size).toBe(1)

    isValid = true

    mutateOpenUpdate<MutationPayload>({
      collectionId,
      elementId: TEST_ITEM_ID,
      debounceMs: 200,
      validateBeforeEnqueue: () => isValid,
      mutateOptimistically: () => {
        collection.update(TEST_ITEM_ID, (draft) => {
          draft.value = 2
        })
      },
      persistMutations: async () => {
        persistCalled += 1
        return { success: true, payload: { ok: true } }
      },
      handleSuccessOrConflictResponse: () => {},
      conflictMessage: 'Conflict'
    })

    vi.advanceTimersByTime(200)
    await submitAllOpenUpdateTransactionsAndWait()

    expect(persistCalled).toBe(1)
    expect(indexedTransactions.size).toBe(0)
  })

  it('flushes matching open update transactions before queueImmediately enqueue', async () => {
    const { collectionId, collection, indexedTransactions } =
      createSingleItemRegistryContext('queue-immediate-flush-open')
    const runMutation = createRevisionMutationRunner({ test: collection })
    const mutateOpenUpdate = createOpenRevisionUpdateMutationRunner({
      test: collection
    })
    const persistOrder: string[] = []

    mutateOpenUpdate<MutationPayload>({
      collectionId,
      elementId: TEST_ITEM_ID,
      debounceMs: 10_000,
      mutateOptimistically: () => {
        collection.update(TEST_ITEM_ID, (draft) => {
          draft.value = 1
        })
      },
      persistMutations: async () => {
        persistOrder.push('open')
        return { success: true, payload: { ok: true } }
      },
      handleSuccessOrConflictResponse: () => {},
      conflictMessage: 'Conflict'
    })

    await runMutation<MutationPayload>({
      mutateOptimistically: () => {
        collection.update(TEST_ITEM_ID, (draft) => {
          draft.value = 2
        })
      },
      persistMutations: async () => {
        persistOrder.push('immediate')
        return { success: true, payload: { ok: true } }
      },
      handleSuccessOrConflictResponse: () => {},
      conflictMessage: 'Conflict'
    })

    expect(persistOrder).toEqual(['open', 'immediate'])
    expect(indexedTransactions.size).toBe(0)
  })

  it('rolls back invalid open update transactions during immediate flush without rolling back the immediate transaction', async () => {
    const { collectionId, collection, indexedTransactions } =
      createSingleItemRegistryContext('queue-immediate-invalid-open')
    const runMutation = createRevisionMutationRunner({ test: collection })
    const mutateOpenUpdate = createOpenRevisionUpdateMutationRunner({
      test: collection
    })
    const persistOrder: string[] = []

    mutateOpenUpdate<MutationPayload>({
      collectionId,
      elementId: TEST_ITEM_ID,
      debounceMs: 10_000,
      validateBeforeEnqueue: () => false,
      mutateOptimistically: () => {
        collection.update(TEST_ITEM_ID, (draft) => {
          draft.value = 1
        })
      },
      persistMutations: async () => {
        persistOrder.push('open')
        return { success: true, payload: { ok: true } }
      },
      handleSuccessOrConflictResponse: () => {},
      conflictMessage: 'Conflict'
    })

    await runMutation<MutationPayload>({
      mutateOptimistically: () => {
        collection.update(TEST_ITEM_ID, (draft) => {
          draft.value = 2
        })
      },
      persistMutations: async () => {
        persistOrder.push('immediate')
        return { success: true, payload: { ok: true } }
      },
      handleSuccessOrConflictResponse: () => {},
      conflictMessage: 'Conflict'
    })

    expect(persistOrder).toEqual(['immediate'])
    expect(indexedTransactions.size).toBe(0)
  })

  it('always resolves when submitting all open update transactions', async () => {
    const { collectionId, collection, indexedTransactions } =
      createSingleItemRegistryContext('open-submit-all')
    const mutateOpenUpdate = createOpenRevisionUpdateMutationRunner({
      test: collection
    })

    mutateOpenUpdate<MutationPayload>({
      collectionId,
      elementId: TEST_ITEM_ID,
      debounceMs: 10_000,
      mutateOptimistically: () => {
        collection.update(TEST_ITEM_ID, (draft) => {
          draft.value = 5
        })
      },
      persistMutations: async () => ({
        success: false,
        conflict: true,
        payload: { ok: true }
      }),
      handleSuccessOrConflictResponse: () => {},
      conflictMessage: 'Conflict'
    })

    await expect(submitAllOpenUpdateTransactionsAndWait()).resolves.toBeUndefined()
    expect(indexedTransactions.size).toBe(0)
  })
})
