import { createCollection } from '@tanstack/svelte-db'
import type { RevisionEnvelope } from '@shared/Revision'
import { describe, expect, it } from 'vitest'
import { revisionCollectionOptions } from '@renderer/data/Collections/RevisionCollection'

type TestRecord = {
  id: string
  value: number
}

let collectionCounter = 0

const nextCollectionId = (label: string): string => {
  collectionCounter += 1
  return `revision-collection-batching-${label}-${collectionCounter}`
}

const createSnapshot = (
  id: string,
  revision: number,
  value: number
): RevisionEnvelope<TestRecord> => ({
  id,
  revision,
  data: {
    id,
    value
  }
})

const createTestCollection = (label: string) => {
  return createCollection(
    revisionCollectionOptions<TestRecord>({
      id: nextCollectionId(label),
      getKey: (record) => record.id
    })
  )
}

describe('revision collection batching', () => {
  it('applies authoritative batch upserts', () => {
    const collection = createTestCollection('upsert-many')

    collection.utils.upsertManyAuthoritative([
      createSnapshot('prompt-1', 1, 10),
      createSnapshot('prompt-2', 1, 20),
      createSnapshot('prompt-3', 1, 30)
    ])

    expect(collection.get('prompt-1')?.value).toBe(10)
    expect(collection.get('prompt-2')?.value).toBe(20)
    expect(collection.get('prompt-3')?.value).toBe(30)
    expect(collection.toArray).toHaveLength(3)
  })

  it('keeps highest revision when duplicate ids arrive in the same batch', () => {
    const collection = createTestCollection('duplicate-revisions')

    collection.utils.upsertManyAuthoritative([
      createSnapshot('prompt-1', 1, 10),
      createSnapshot('prompt-1', 2, 99),
      createSnapshot('prompt-1', 1, 5)
    ])

    expect(collection.get('prompt-1')?.value).toBe(99)
    expect(collection.utils.getAuthoritativeRevision('prompt-1')).toBe(2)
  })

  it('applies batched authoritative deletes', () => {
    const collection = createTestCollection('delete-many')

    collection.utils.upsertManyAuthoritative([
      createSnapshot('prompt-1', 1, 10),
      createSnapshot('prompt-2', 1, 20),
      createSnapshot('prompt-3', 1, 30)
    ])
    collection.utils.deleteManyAuthoritative(['prompt-1', 'prompt-3'])

    expect(collection.get('prompt-1')).toBeUndefined()
    expect(collection.get('prompt-3')).toBeUndefined()
    expect(collection.get('prompt-2')?.value).toBe(20)
    expect(collection.toArray).toHaveLength(1)
  })
})
