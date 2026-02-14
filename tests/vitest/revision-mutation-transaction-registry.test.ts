import { createCollection } from '@tanstack/svelte-db'
import type { RevisionEnvelope } from '@shared/Revision'
import { describe, expect, it } from 'vitest'
import { revisionCollectionOptions } from '@renderer/data/Collections/RevisionCollection'
import { createRevisionMutationRunner } from '@renderer/data/IpcFramework/RevisionMutation'
import { getTransactionsForElement } from '@renderer/data/IpcFramework/RevisionMutationTransactionRegistry'

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
})
