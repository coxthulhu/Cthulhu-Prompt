import { beforeEach, describe, expect, it, vi } from 'vitest'

/** Hoisted authoritative stores used by the main persistence planner. */
const mockDomainData = vi.hoisted(() => {
  /** Generic committed entry shape sufficient for persistence planning. */
  type Entry = {
    revision: number
    committed: unknown
    persistenceFields: unknown
  }
  /** Entity stores keyed by authoritative domain type and ID. */
  const entries = {
    systemSettings: new Map<string, Entry>(),
    workspace: new Map<string, Entry>(),
    promptCollection: new Map<string, Entry>(),
    category: new Map<string, Entry>(),
    prompt: new Map<string, Entry>(),
    note: new Map<string, Entry>(),
    promptTemplate: new Map<string, Entry>(),
    userPersistence: new Map<string, Entry>(),
    /** Optional visibility participates in the complete persistence graph. */
    attachedNoteUiState: new Map<string, Entry>(),
    workspaceUiState: new Map<string, Entry>()
  }
  /** Creates the committed-store reads used by domain persistence planning. */
  const createStore = (entityType: keyof typeof entries) => ({
    getEntry: (id: string) => entries[entityType].get(id) ?? null,
    getAllEntries: () => [...entries[entityType].values()]
  })
  /** Main data registry mock with one committed store per domain type. */
  const data = {
    systemSettings: { committedStore: createStore('systemSettings') },
    workspace: { committedStore: createStore('workspace') },
    promptCollection: { committedStore: createStore('promptCollection') },
    category: { committedStore: createStore('category') },
    prompt: { committedStore: createStore('prompt') },
    note: { committedStore: createStore('note'), targetPolicy: 'requirePresent' },
    promptTemplate: { committedStore: createStore('promptTemplate') },
    userPersistence: { committedStore: createStore('userPersistence') },
    attachedNoteUiState: { committedStore: createStore('attachedNoteUiState'), targetPolicy: 'deleteIfPresent' },
    workspaceUiState: { committedStore: createStore('workspaceUiState') }
  }
  /** Clears authoritative entries between persistence-planning tests. */
  const reset = (): void => {
    for (const store of Object.values(entries)) store.clear()
  }
  /** Seeds one committed entity and its current persistence fields. */
  const seed = (
    entityType: keyof typeof entries,
    id: string,
    committed: unknown,
    persistenceFields: unknown
  ): void => {
    entries[entityType].set(id, { revision: 1, committed, persistenceFields })
  }
  return { data, entries, reset, seed }
})

vi.mock('../../src/main/Data/Data', () => ({ data: mockDomainData.data }))

import { projectDomainTransitions } from '../../src/main/Data/DomainTransitions'





describe('domain persistence planning', () => {
  beforeEach(() => mockDomainData.reset())

  it('applies an update recipe once and retains complete before and after nodes', () => {
    /** Current category record projected by one recipe-based update. */
    const category = {
      id: 'category',
      displayName: 'Before',
      shortDescription: null,
      description: null
    }
    mockDomainData.seed('category', category.id, category, {
      workspaceId: 'workspace',
      workspacePath: 'C:\\Workspace\\DefaultProject',
      promptCollectionId: 'Root',
      collectionFolderName: 'Root',
      kind: 'prompt',
      categoryStem: 'Before',
    })
    /** Recipe invocation count proving main projection does not replay domain changes. */
    let recipeInvocationCount = 0
    /** Projection containing the updated category before and after nodes. */
    const projection = projectDomainTransitions(
      [
        {
          type: 'update',
          entityType: 'category',
          id: category.id,
          recipe: (draft) => {
            recipeInvocationCount += 1
            draft.displayName = 'After'
          }
        }
      ],
      [{ entityType: 'category', id: category.id, expected: 'revision', revision: 1 }]
    )
    expect(recipeInvocationCount).toBe(1)
    expect(projection.transitions[0]).toMatchObject({
      before: { revision: 1, data: { displayName: 'Before' } },
      after: { revision: 2, data: { displayName: 'After' } },
      expectedRevision: 1
    })
  })

})
