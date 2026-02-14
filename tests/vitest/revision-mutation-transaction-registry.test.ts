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
  submitAllOpenUpdateTransactionsAndWait
} from '@renderer/data/IpcFramework/RevisionMutationTransactionRegistry'

type TestRecord = {
  id: string
  value: number
}

type MutationPayload = {
  ok: true
}

let collectionCounter = 0

const nextCollectionId = (label: string): string => {
  collectionCounter += 1
  return `revision-mutation-registry-${label}-${collectionCounter}`
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

describe('revision mutation transaction registry', () => {
  afterEach(async () => {
    await submitAllOpenUpdateTransactionsAndWait()
    vi.useRealTimers()
  })

  it('indexes by element with dedupe and marks queued transactions', async () => {
    const collectionId = nextCollectionId('dedupe')
    const collection = createTestCollection(collectionId, [
      {
        id: 'item-1',
        revision: 1,
        data: { id: 'item-1', value: 0 }
      }
    ])
    const runMutation = createRevisionMutationRunner({ test: collection })
    const indexedTransactions = getTransactionsForElement(collectionId, 'item-1')
    let queuedImmediately: boolean | null = null

    await runMutation<MutationPayload>({
      mutateOptimistically: () => {
        collection.update('item-1', (draft) => {
          draft.value = 1
        })
        collection.update('item-1', (draft) => {
          draft.value = 2
        })
      },
      persistMutations: async () => {
        expect(indexedTransactions.size).toBe(1)
        const [entry] = [...indexedTransactions]
        queuedImmediately = entry?.queuedImmediately ?? null
        return { success: true, payload: { ok: true } }
      },
      handleSuccessOrConflictResponse: () => {},
      conflictMessage: 'Conflict'
    })

    expect(queuedImmediately).toBe(true)
    expect(indexedTransactions.size).toBe(0)
  })

  it('clears entries when persistence fails', async () => {
    const collectionId = nextCollectionId('failure')
    const collection = createTestCollection(collectionId, [
      {
        id: 'item-1',
        revision: 1,
        data: { id: 'item-1', value: 0 }
      }
    ])
    const runMutation = createRevisionMutationRunner({ test: collection })
    const indexedTransactions = getTransactionsForElement(collectionId, 'item-1')

    await expect(
      runMutation<MutationPayload>({
        mutateOptimistically: () => {
          collection.update('item-1', (draft) => {
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
    const collectionId = nextCollectionId('optimistic-error')
    const collection = createTestCollection(collectionId, [
      {
        id: 'item-1',
        revision: 1,
        data: { id: 'item-1', value: 0 }
      }
    ])
    const runMutation = createRevisionMutationRunner({ test: collection })
    const indexedTransactions = getTransactionsForElement(collectionId, 'item-1')
    let persistCalled = false

    await expect(
      runMutation<MutationPayload>({
        mutateOptimistically: () => {
          collection.update('item-1', (draft) => {
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

    const collectionId = nextCollectionId('open-debounce')
    const collection = createTestCollection(collectionId, [
      {
        id: 'item-1',
        revision: 1,
        data: { id: 'item-1', value: 0 }
      }
    ])
    const mutateOpenUpdate = createOpenRevisionUpdateMutationRunner({
      test: collection
    })
    const indexedTransactions = getTransactionsForElement(collectionId, 'item-1')
    let persistCalled = 0
    let queuedImmediately: boolean | null = null

    const mutateFirstValue = (value: number) => {
      mutateOpenUpdate<MutationPayload>({
        collectionId,
        elementId: 'item-1',
        debounceMs: 200,
        mutateOptimistically: () => {
          collection.update('item-1', (draft) => {
            draft.value = value
          })
        },
        persistMutations: async () => {
          persistCalled += 1
          const [entry] = [...indexedTransactions]
          queuedImmediately = entry?.queuedImmediately ?? null
          return { success: true, payload: { ok: true } }
        },
        handleSuccessOrConflictResponse: () => {},
        conflictMessage: 'Conflict'
      })
    }

    mutateFirstValue(1)
    mutateFirstValue(2)

    expect(indexedTransactions.size).toBe(1)

    vi.advanceTimersByTime(199)
    await Promise.resolve()
    expect(persistCalled).toBe(0)

    vi.advanceTimersByTime(1)
    await submitAllOpenUpdateTransactionsAndWait()

    expect(persistCalled).toBe(1)
    expect(queuedImmediately).toBe(false)
    expect(indexedTransactions.size).toBe(0)
  })

  it('sends open update transactions immediately when requested', async () => {
    vi.useFakeTimers()

    const collectionId = nextCollectionId('open-send-now')
    const collection = createTestCollection(collectionId, [
      {
        id: 'item-1',
        revision: 1,
        data: { id: 'item-1', value: 0 }
      }
    ])
    const mutateOpenUpdate = createOpenRevisionUpdateMutationRunner({
      test: collection
    })
    const indexedTransactions = getTransactionsForElement(collectionId, 'item-1')
    let persistCalled = 0

    mutateOpenUpdate<MutationPayload>({
      collectionId,
      elementId: 'item-1',
      debounceMs: 10_000,
      mutateOptimistically: () => {
        collection.update('item-1', (draft) => {
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

    sendOpenUpdateTransactionIfPresent(collectionId, 'item-1')
    await submitAllOpenUpdateTransactionsAndWait()

    expect(persistCalled).toBe(1)
    expect(indexedTransactions.size).toBe(0)

    vi.advanceTimersByTime(10_000)
    await submitAllOpenUpdateTransactionsAndWait()
    expect(persistCalled).toBe(1)
  })

  it('keeps invalid debounced open update transactions pending until validation passes', async () => {
    vi.useFakeTimers()

    const collectionId = nextCollectionId('open-validation-debounce')
    const collection = createTestCollection(collectionId, [
      {
        id: 'item-1',
        revision: 1,
        data: { id: 'item-1', value: 0 }
      }
    ])
    const mutateOpenUpdate = createOpenRevisionUpdateMutationRunner({
      test: collection
    })
    const indexedTransactions = getTransactionsForElement(collectionId, 'item-1')
    let persistCalled = 0
    let isValid = false

    mutateOpenUpdate<MutationPayload>({
      collectionId,
      elementId: 'item-1',
      debounceMs: 200,
      validateBeforeEnqueue: () => isValid,
      mutateOptimistically: () => {
        collection.update('item-1', (draft) => {
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
      elementId: 'item-1',
      debounceMs: 200,
      validateBeforeEnqueue: () => isValid,
      mutateOptimistically: () => {
        collection.update('item-1', (draft) => {
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
    const collectionId = nextCollectionId('queue-immediate-flush-open')
    const collection = createTestCollection(collectionId, [
      {
        id: 'item-1',
        revision: 1,
        data: { id: 'item-1', value: 0 }
      }
    ])
    const runMutation = createRevisionMutationRunner({ test: collection })
    const mutateOpenUpdate = createOpenRevisionUpdateMutationRunner({
      test: collection
    })
    const persistOrder: string[] = []
    const indexedTransactions = getTransactionsForElement(collectionId, 'item-1')

    mutateOpenUpdate<MutationPayload>({
      collectionId,
      elementId: 'item-1',
      debounceMs: 10_000,
      mutateOptimistically: () => {
        collection.update('item-1', (draft) => {
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
        collection.update('item-1', (draft) => {
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
    const collectionId = nextCollectionId('queue-immediate-invalid-open')
    const collection = createTestCollection(collectionId, [
      {
        id: 'item-1',
        revision: 1,
        data: { id: 'item-1', value: 0 }
      }
    ])
    const runMutation = createRevisionMutationRunner({ test: collection })
    const mutateOpenUpdate = createOpenRevisionUpdateMutationRunner({
      test: collection
    })
    const persistOrder: string[] = []
    const indexedTransactions = getTransactionsForElement(collectionId, 'item-1')

    mutateOpenUpdate<MutationPayload>({
      collectionId,
      elementId: 'item-1',
      debounceMs: 10_000,
      validateBeforeEnqueue: () => false,
      mutateOptimistically: () => {
        collection.update('item-1', (draft) => {
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
        collection.update('item-1', (draft) => {
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
    const collectionId = nextCollectionId('open-submit-all')
    const collection = createTestCollection(collectionId, [
      {
        id: 'item-1',
        revision: 1,
        data: { id: 'item-1', value: 0 }
      }
    ])
    const mutateOpenUpdate = createOpenRevisionUpdateMutationRunner({
      test: collection
    })
    const indexedTransactions = getTransactionsForElement(collectionId, 'item-1')

    mutateOpenUpdate<MutationPayload>({
      collectionId,
      elementId: 'item-1',
      debounceMs: 10_000,
      mutateOptimistically: () => {
        collection.update('item-1', (draft) => {
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
