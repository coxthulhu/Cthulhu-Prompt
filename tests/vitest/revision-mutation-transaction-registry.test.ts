import { createCollection, localOnlyCollectionOptions } from '@tanstack/svelte-db'
import type { RevisionEnvelope } from '@shared/Revision'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { revisionCollectionOptions } from '@renderer/data/Collections/RevisionCollection'
import {
  createPacedRevisionUpdateMutationRunner,
  createRevisionMutationRunner
} from '@renderer/data/IpcFramework/RevisionMutation'
import {
  sendPacedUpdateTransactionIfPresent,
  submitPacedUpdateTransactionAndWait,
  submitAllPacedUpdateTransactionsAndWait
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

  return {
    collectionId,
    collection
  }
}

describe('revision mutation transaction registry', () => {
  afterEach(async () => {
    await submitAllPacedUpdateTransactionsAndWait()
    vi.useRealTimers()
  })

  it('runs immediate mutations and persists once', async () => {
    const { collection } = createSingleItemRegistryContext('immediate')
    const runMutation = createRevisionMutationRunner({ test: collection }, { test: collection })
    let persistCalled = 0

    await runMutation<MutationPayload>({
      mutateOptimistically: ({ collections }) => {
        collections.test.update(TEST_ITEM_ID, (draft) => {
          draft.value = 1
        })
        collections.test.update(TEST_ITEM_ID, (draft) => {
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

    expect(persistCalled).toBe(1)
  })

  it('clears entries when persistence fails', async () => {
    const { collection } = createSingleItemRegistryContext('failure')
    const runMutation = createRevisionMutationRunner({ test: collection }, { test: collection })

    await expect(
      runMutation<MutationPayload>({
        mutateOptimistically: ({ collections }) => {
          collections.test.update(TEST_ITEM_ID, (draft) => {
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
  })

  it('clears entries when mutateOptimistically throws', async () => {
    const { collection } = createSingleItemRegistryContext('optimistic-error')
    const runMutation = createRevisionMutationRunner({ test: collection }, { test: collection })
    let persistCalled = false

    await expect(
      runMutation<MutationPayload>({
        mutateOptimistically: ({ collections }) => {
          collections.test.update(TEST_ITEM_ID, (draft) => {
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
  })

  it('does not persist after insert-delete cancellation', async () => {
    const collectionId = nextCollectionId('cancel')
    const collection = createTestCollection(collectionId, [])
    const runMutation = createRevisionMutationRunner({ test: collection }, { test: collection })
    let persistCalled = false

    await runMutation<MutationPayload>({
      mutateOptimistically: ({ collections }) => {
        collections.test.insert({
          id: 'item-new',
          value: 1
        })
        collections.test.delete('item-new')
      },
      persistMutations: async () => {
        persistCalled = true
        return { success: true, payload: { ok: true } }
      },
      handleSuccessOrConflictResponse: () => {},
      conflictMessage: 'Conflict'
    })

    expect(persistCalled).toBe(false)
  })

  it('debounces paced update transactions and enqueues only once', async () => {
    vi.useFakeTimers()

    const { collectionId, collection } = createSingleItemRegistryContext('paced-debounce')
    const mutatePacedUpdate = createPacedRevisionUpdateMutationRunner(
      { test: collection },
      { test: collection }
    )
    let persistCalled = 0

    const queuePacedUpdateWithValue = (value: number) => {
      mutatePacedUpdate<MutationPayload>({
        collectionId,
        elementId: TEST_ITEM_ID,
        debounceMs: 200,
        mutateOptimistically: ({ collections }) => {
          collections.test.update(TEST_ITEM_ID, (draft) => {
            draft.value = value
          })
        },
        persistMutations: async () => {
          persistCalled += 1
          return { success: true, payload: { ok: true } }
        },
        handleSuccessOrConflictResponse: () => {},
        conflictMessage: 'Conflict'
      })
    }

    queuePacedUpdateWithValue(1)
    queuePacedUpdateWithValue(2)

    vi.advanceTimersByTime(199)
    await Promise.resolve()
    expect(persistCalled).toBe(0)

    vi.advanceTimersByTime(1)
    await submitAllPacedUpdateTransactionsAndWait()

    expect(persistCalled).toBe(1)
  })

  it('sends paced update transactions immediately when requested', async () => {
    vi.useFakeTimers()

    const { collectionId, collection } = createSingleItemRegistryContext('paced-send-now')
    const mutatePacedUpdate = createPacedRevisionUpdateMutationRunner(
      { test: collection },
      { test: collection }
    )
    let persistCalled = 0

    mutatePacedUpdate<MutationPayload>({
      collectionId,
      elementId: TEST_ITEM_ID,
      debounceMs: 10_000,
      mutateOptimistically: ({ collections }) => {
        collections.test.update(TEST_ITEM_ID, (draft) => {
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

    sendPacedUpdateTransactionIfPresent(collectionId, TEST_ITEM_ID)
    await submitAllPacedUpdateTransactionsAndWait()

    expect(persistCalled).toBe(1)

    vi.advanceTimersByTime(10_000)
    await submitAllPacedUpdateTransactionsAndWait()
    expect(persistCalled).toBe(1)
  })

  it('applies draft-only optimistic updates immediately without creating paced transactions', async () => {
    vi.useFakeTimers()

    const { collectionId, collection } = createSingleItemRegistryContext('paced-draft-only')
    const draftCollection = createCollection(
      localOnlyCollectionOptions<TestRecord>({
        id: nextCollectionId('paced-draft-only-local'),
        getKey: (record) => record.id
      })
    )
    draftCollection.insert({ id: TEST_ITEM_ID, value: 0 })
    const mutatePacedUpdate = createPacedRevisionUpdateMutationRunner(
      { test: collection },
      { draft: draftCollection }
    )
    let persistCalled = 0

    mutatePacedUpdate<MutationPayload>({
      collectionId,
      elementId: TEST_ITEM_ID,
      debounceMs: 200,
      draftOnlyChange: true,
      mutateOptimistically: ({ collections }) => {
        collections.draft.update(TEST_ITEM_ID, (draft) => {
          draft.value = 11
        })
      },
      persistMutations: async () => {
        persistCalled += 1
        return { success: true, payload: { ok: true } }
      },
      handleSuccessOrConflictResponse: () => {},
      conflictMessage: 'Conflict'
    })

    expect(draftCollection.get(TEST_ITEM_ID)!.value).toBe(11)
    expect(sendPacedUpdateTransactionIfPresent(collectionId, TEST_ITEM_ID)).toBe(false)

    vi.advanceTimersByTime(200)
    await submitAllPacedUpdateTransactionsAndWait()
    expect(persistCalled).toBe(0)
  })

  it('waits for the targeted paced update transaction when it is already in flight', async () => {
    const { collectionId, collection } = createSingleItemRegistryContext(
      'paced-submit-targeted-in-flight'
    )
    const mutatePacedUpdate = createPacedRevisionUpdateMutationRunner(
      { test: collection },
      { test: collection }
    )
    let resolvePersist: (() => void) | null = null
    const persistGate = new Promise<void>((resolve) => {
      resolvePersist = resolve
    })
    let persistFinished = false

    mutatePacedUpdate<MutationPayload>({
      collectionId,
      elementId: TEST_ITEM_ID,
      debounceMs: 10_000,
      mutateOptimistically: ({ collections }) => {
        collections.test.update(TEST_ITEM_ID, (draft) => {
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

    sendPacedUpdateTransactionIfPresent(collectionId, TEST_ITEM_ID)
    const waitTask = submitPacedUpdateTransactionAndWait(collectionId, TEST_ITEM_ID)

    await Promise.resolve()
    expect(persistFinished).toBe(false)

    resolvePersist!()
    await waitTask

    expect(persistFinished).toBe(true)
  })

  it('keeps invalid debounced paced update transactions pending until validation passes', async () => {
    vi.useFakeTimers()

    const { collectionId, collection } = createSingleItemRegistryContext(
      'paced-validation-debounce'
    )
    const mutatePacedUpdate = createPacedRevisionUpdateMutationRunner(
      { test: collection },
      { test: collection }
    )
    let persistCalled = 0
    let isValid = false

    mutatePacedUpdate<MutationPayload>({
      collectionId,
      elementId: TEST_ITEM_ID,
      debounceMs: 200,
      validateBeforeEnqueue: () => isValid,
      mutateOptimistically: ({ collections }) => {
        collections.test.update(TEST_ITEM_ID, (draft) => {
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
    await submitAllPacedUpdateTransactionsAndWait()

    expect(persistCalled).toBe(0)

    isValid = true

    mutatePacedUpdate<MutationPayload>({
      collectionId,
      elementId: TEST_ITEM_ID,
      debounceMs: 200,
      validateBeforeEnqueue: () => isValid,
      mutateOptimistically: ({ collections }) => {
        collections.test.update(TEST_ITEM_ID, (draft) => {
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
    await submitAllPacedUpdateTransactionsAndWait()

    expect(persistCalled).toBe(1)
  })

  it('flushes matching paced update transactions before queueImmediately enqueue', async () => {
    const { collectionId, collection } = createSingleItemRegistryContext(
      'queue-immediate-flush-paced'
    )
    const runMutation = createRevisionMutationRunner({ test: collection }, { test: collection })
    const mutatePacedUpdate = createPacedRevisionUpdateMutationRunner(
      { test: collection },
      { test: collection }
    )
    const persistOrder: string[] = []

    mutatePacedUpdate<MutationPayload>({
      collectionId,
      elementId: TEST_ITEM_ID,
      debounceMs: 10_000,
      mutateOptimistically: ({ collections }) => {
        collections.test.update(TEST_ITEM_ID, (draft) => {
          draft.value = 1
        })
      },
      persistMutations: async () => {
        persistOrder.push('paced')
        return { success: true, payload: { ok: true } }
      },
      handleSuccessOrConflictResponse: () => {},
      conflictMessage: 'Conflict'
    })

    await runMutation<MutationPayload>({
      mutateOptimistically: ({ collections }) => {
        collections.test.update(TEST_ITEM_ID, (draft) => {
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

    expect(persistOrder).toEqual(['paced', 'immediate'])
  })

  it('rolls back invalid paced update transactions during immediate flush without rolling back the immediate transaction', async () => {
    const { collectionId, collection } = createSingleItemRegistryContext(
      'queue-immediate-invalid-paced'
    )
    const runMutation = createRevisionMutationRunner({ test: collection }, { test: collection })
    const mutatePacedUpdate = createPacedRevisionUpdateMutationRunner(
      { test: collection },
      { test: collection }
    )
    const persistOrder: string[] = []

    mutatePacedUpdate<MutationPayload>({
      collectionId,
      elementId: TEST_ITEM_ID,
      debounceMs: 10_000,
      validateBeforeEnqueue: () => false,
      mutateOptimistically: ({ collections }) => {
        collections.test.update(TEST_ITEM_ID, (draft) => {
          draft.value = 1
        })
      },
      persistMutations: async () => {
        persistOrder.push('paced')
        return { success: true, payload: { ok: true } }
      },
      handleSuccessOrConflictResponse: () => {},
      conflictMessage: 'Conflict'
    })

    await runMutation<MutationPayload>({
      mutateOptimistically: ({ collections }) => {
        collections.test.update(TEST_ITEM_ID, (draft) => {
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
  })

  it('replays immediate optimistic mutations after invalid paced rollback', async () => {
    const { collectionId, collection } = createSingleItemRegistryContext(
      'queue-immediate-replay-after-paced-rollback'
    )
    const runMutation = createRevisionMutationRunner({ test: collection }, { test: collection })
    const mutatePacedUpdate = createPacedRevisionUpdateMutationRunner(
      { test: collection },
      { test: collection }
    )
    let pacedPersistCalled = 0
    let immediatePersistedValue: number | null = null

    mutatePacedUpdate<MutationPayload>({
      collectionId,
      elementId: TEST_ITEM_ID,
      debounceMs: 10_000,
      validateBeforeEnqueue: () => false,
      mutateOptimistically: ({ collections }) => {
        collections.test.update(TEST_ITEM_ID, (draft) => {
          draft.value = 10
        })
      },
      persistMutations: async () => {
        pacedPersistCalled += 1
        return { success: true, payload: { ok: true } }
      },
      handleSuccessOrConflictResponse: () => {},
      conflictMessage: 'Conflict'
    })

    await runMutation<MutationPayload>({
      mutateOptimistically: ({ collections }) => {
        const nextValue = collection.get(TEST_ITEM_ID)!.value + 1
        collections.test.update(TEST_ITEM_ID, (draft) => {
          draft.value = nextValue
        })
      },
      persistMutations: async ({ transaction }) => {
        const updatedRecord = transaction.mutations.find(
          (mutation) => mutation.key === TEST_ITEM_ID
        )?.modified as TestRecord | undefined
        immediatePersistedValue = updatedRecord?.value ?? null
        return { success: true, payload: { ok: true } }
      },
      handleSuccessOrConflictResponse: () => {},
      conflictMessage: 'Conflict'
    })

    expect(pacedPersistCalled).toBe(0)
    expect(immediatePersistedValue).toBe(1)
  })

  it('always resolves when submitting all paced update transactions', async () => {
    const { collectionId, collection } = createSingleItemRegistryContext('paced-submit-all')
    const mutatePacedUpdate = createPacedRevisionUpdateMutationRunner(
      { test: collection },
      { test: collection }
    )

    mutatePacedUpdate<MutationPayload>({
      collectionId,
      elementId: TEST_ITEM_ID,
      debounceMs: 10_000,
      mutateOptimistically: ({ collections }) => {
        collections.test.update(TEST_ITEM_ID, (draft) => {
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

    await expect(submitAllPacedUpdateTransactionsAndWait()).resolves.toBeUndefined()
  })
})
