import { beforeEach, describe, expect, it, vi } from 'vitest'
import type {
  DomainPlannerEntityMap,
  DomainState
} from '@shared/DomainChanges'
import {
  planDeleteCategoryDomainMutation,
  planMoveMarkdownContentDomainMutation
} from '@shared/DomainMutations'
import { PromptStatus } from '@shared/Prompt'
import type { PromptFolder } from '@shared/PromptFolder'

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
    promptFolder: new Map<string, Entry>(),
    category: new Map<string, Entry>(),
    prompt: new Map<string, Entry>(),
    promptTemplate: new Map<string, Entry>()
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
    promptFolder: { committedStore: createStore('promptFolder') },
    category: { committedStore: createStore('category') },
    prompt: { committedStore: createStore('prompt') },
    promptTemplate: { committedStore: createStore('promptTemplate') }
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

import { planDomainPersistenceChanges } from '../../src/main/Persistence/DomainPersistence'

/** Creates shared domain state over the same entries used by the persistence planner. */
const createMainLikeDomainState = (): DomainState => ({
  get: (entityType, id) =>
    mockDomainData.entries[entityType].get(id)?.committed as
      | DomainPlannerEntityMap[typeof entityType]
      | undefined,
  getAll: (entityType) =>
    [...mockDomainData.entries[entityType].values()].map((entry) => entry.committed) as Array<
      DomainPlannerEntityMap[typeof entityType]
    >
})

/** Creates a root folder with explicit active content entries. */
const createRootFolder = (
  id: string,
  kind: PromptFolder['kind'],
  entries: Array<{ kind: PromptFolder['kind']; id: string }>,
  categoryIds: string[] = []
): PromptFolder => ({
  id,
  kind,
  folderName: id,
  displayName: id,
  completedPromptIds: [],
  categoryOrder: {
    categories: [
      { categoryId: null, entries },
      ...categoryIds.map((categoryId) => ({ categoryId, entries: [] }))
    ]
  },
  settings: { folderDescription: null }
})

/** Creates persistence fields for one root folder. */
const createFolderPersistenceFields = (folderPath: string, kind: PromptFolder['kind']) => ({
  workspaceId: 'workspace',
  workspacePath: 'C:\\Workspace',
  folderName: folderPath,
  folderPath,
  kind
})

/** Creates persistence fields for one active prompt or template. */
const createMarkdownPersistenceFields = (promptFolderId: string, promptId: string) => ({
  workspaceId: 'workspace',
  workspacePath: 'C:\\Workspace',
  folderPath: `${promptFolderId}\\Active`,
  promptFolderId,
  promptId,
  promptStem: 'Same',
  needsFilenameIdSuffix: false
})

describe('domain persistence planning', () => {
  beforeEach(() => mockDomainData.reset())

  it('adds persistence-only sibling filename changes during prompt movement', () => {
    /** Source root initially owning the moved prompt. */
    const source = createRootFolder('Source', 'prompt', [{ kind: 'prompt', id: 'moving' }])
    /** Destination root containing one same-title prompt. */
    const destination = createRootFolder('Destination', 'prompt', [
      { kind: 'prompt', id: 'sibling' }
    ])
    mockDomainData.seed(
      'promptFolder',
      source.id,
      source,
      createFolderPersistenceFields(source.id, 'prompt')
    )
    mockDomainData.seed(
      'promptFolder',
      destination.id,
      destination,
      createFolderPersistenceFields(destination.id, 'prompt')
    )
    for (const promptId of ['moving', 'sibling']) {
      /** Full authoritative prompt persisted by the main process. */
      const prompt = {
        id: promptId,
        title: 'Same',
        fallbackTitle: '',
        createdAt: 'created',
        modifiedAt: 'modified',
        promptText: promptId,
        status: PromptStatus.Todo
      }
      mockDomainData.seed(
        'prompt',
        promptId,
        prompt,
        createMarkdownPersistenceFields(promptId === 'moving' ? source.id : destination.id, promptId)
      )
    }

    /** Shared movement changes projected into main persistence writes. */
    const plan = planMoveMarkdownContentDomainMutation(createMainLikeDomainState(), {
      kind: 'prompt',
      sourcePromptFolderId: source.id,
      destinationPromptFolderId: destination.id,
      contentId: 'moving',
      categoryId: null,
      previousEntryId: 'sibling'
    })
    expect(Array.isArray(plan)).toBe(true)
    if (!Array.isArray(plan)) return
    /** Persistence changes including the non-domain sibling filename adjustment. */
    const persistenceChanges = planDomainPersistenceChanges(plan)
    /** Moved prompt persistence change with cross-root path metadata. */
    const moving = persistenceChanges.find(
      (change) => change.entityType === 'prompt' && change.id === 'moving'
    )
    /** Same-title destination sibling adjusted only in persistence metadata. */
    const sibling = persistenceChanges.find(
      (change) => change.entityType === 'prompt' && change.id === 'sibling'
    )
    expect(moving).toMatchObject({
      type: 'upsert',
      persistenceFields: {
        promptFolderId: destination.id,
        needsFilenameIdSuffix: true
      }
    })
    expect(sibling).toMatchObject({
      type: 'upsert',
      persistenceFields: { needsFilenameIdSuffix: true }
    })
    expect(plan.some((change) => change.id === 'sibling')).toBe(false)
  })

  it('removes the surviving category filename suffix after deleting its duplicate', () => {
    /** Root containing two duplicate-named category groups. */
    const root = createRootFolder('Root', 'prompt', [], ['delete', 'survivor'])
    mockDomainData.seed(
      'promptFolder',
      root.id,
      root,
      createFolderPersistenceFields(root.id, 'prompt')
    )
    for (const categoryId of ['delete', 'survivor']) {
      /** Duplicate-named category with an existing ID-suffixed filename. */
      const category = { id: categoryId, displayName: 'Same', description: null }
      mockDomainData.seed('category', categoryId, category, {
        workspaceId: 'workspace',
        workspacePath: 'C:\\Workspace',
        rootPromptFolderId: root.id,
        rootFolderName: root.id,
        kind: 'prompt',
        categoryStem: `Same-${categoryId}`,
        needsFilenameIdSuffix: true
      })
    }

    /** Shared deletion plan used to calculate category file cleanup. */
    const plan = planDeleteCategoryDomainMutation(createMainLikeDomainState(), {
      categoryId: 'delete',
      promptFolderId: root.id,
      modifiedAt: 'renderer-time'
    })
    expect(Array.isArray(plan)).toBe(true)
    if (!Array.isArray(plan)) return
    /** Persistence-only update for the surviving category filename. */
    const survivor = planDomainPersistenceChanges(plan).find(
      (change) => change.entityType === 'category' && change.id === 'survivor'
    )
    expect(survivor).toMatchObject({
      type: 'upsert',
      persistenceFields: {
        categoryStem: 'Same-survivor',
        needsFilenameIdSuffix: false
      }
    })
    expect(plan.some((change) => change.id === 'survivor')).toBe(false)
  })
})
