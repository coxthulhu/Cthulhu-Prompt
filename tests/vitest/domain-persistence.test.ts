import { beforeEach, describe, expect, it, vi } from 'vitest'
import type {
  DomainPlannerEntityMap,
  DomainState
} from '@shared/DomainChanges'
import { planDeleteCategoryDomainMutation } from '@shared/CategoryDomainMutations'
import { planCreateCategoryDomainMutation } from '@shared/CategoryDomainMutations'
import { planPromptMove } from '@shared/MarkdownContentDomainMutations'
import { PromptStatus } from '@shared/Prompt'
import type { PromptFolder } from '@shared/PromptFolder'
import { planRenamePromptFolderDomainMutation } from '@shared/PromptFolderDomainMutations'

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

import { projectDomainTransitions } from '../../src/main/Data/DomainTransitions'
import { planDomainStorageTransitions } from '../../src/main/Persistence/DomainStorageAdapters'

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

  it.each([
    ['active prompt', 'prompt', 'prompt', 'active'],
    ['completed prompt', 'prompt', 'prompt', 'completed'],
    ['template', 'template', 'promptTemplate', 'active']
  ] as const)(
    'treats %s root descendant relocation as metadata-only storage',
    (_caseName, kind, contentEntityType, location) => {
      /** Root folder whose directory and loaded descendants will move together. */
      const root = createRootFolder(
        'Root',
        kind,
        [{ kind, id: 'content' }],
        ['category']
      )
      if (location === 'completed') {
        root.categoryOrder.categories[0]!.entries = []
        root.completedPromptIds = ['content']
      }
      /** Workspace establishing root ownership for canonical storage derivation. */
      const workspace = {
        id: 'workspace',
        workspacePath: 'C:\\Workspace',
        workspaceName: 'Workspace',
        entries: [{ kind: 'folder' as const, id: root.id }]
      }
      /** Loaded category physically contained by the renamed root. */
      const category = { id: 'category', displayName: 'Category', description: null }
      /** Loaded prompt or template physically contained by the renamed root. */
      const content =
        kind === 'prompt'
          ? {
              id: 'content',
              title: 'Content',
              fallbackTitle: '',
              createdAt: 'created',
              modifiedAt: 'modified',
              promptText: 'content',
              status: PromptStatus.Todo
            }
          : {
              id: 'content',
              title: 'Content',
              fallbackTitle: '',
              createdAt: 'created',
              modifiedAt: 'modified',
              promptText: 'content'
            }
      mockDomainData.seed('workspace', workspace.id, workspace, {
        workspacePath: workspace.workspacePath,
        workspaceInfoPath: 'C:\\Workspace\\Workspace.cthulhuprompt.json'
      })
      mockDomainData.seed(
        'promptFolder',
        root.id,
        root,
        createFolderPersistenceFields(root.folderName, kind)
      )
      mockDomainData.seed('category', category.id, category, {
        workspaceId: workspace.id,
        workspacePath: workspace.workspacePath,
        rootPromptFolderId: root.id,
        rootFolderName: root.folderName,
        kind,
        categoryStem: category.displayName,
        needsFilenameIdSuffix: false
      })
      mockDomainData.seed(contentEntityType, content.id, content, {
        ...createMarkdownPersistenceFields(root.id, content.id),
        promptStem: content.title,
        folderPath:
          kind === 'template'
            ? root.folderName
            : `${root.folderName}\\${location === 'completed' ? 'Completed' : 'Active'}`
      })

      /** Shared rename plan projected into root and descendant storage transitions. */
      const plan = planRenamePromptFolderDomainMutation(createMainLikeDomainState(), {
        promptFolderId: root.id,
        displayName: 'Renamed Root'
      })
      expect(Array.isArray(plan)).toBe(true)
      if (!Array.isArray(plan)) return
      /** Complete storage plan after deriving every loaded descendant's new path. */
      const projection = projectDomainTransitions(plan, [
        { entityType: 'promptFolder', id: root.id, expected: 'revision', revision: 1 }
      ])
      /** Root and descendant persistence transitions classified by physical work. */
      const storageTransitions = planDomainStorageTransitions(
        projection.beforeGraph,
        projection.afterGraph,
        projection.transitions
      )
      /** Revision-bearing root transition that performs the directory rename. */
      const rootTransition = storageTransitions.find(
        (transition) => transition.entityType === 'promptFolder' && transition.id === root.id
      )
      /** Category transition updating only its in-memory root path. */
      const categoryTransition = storageTransitions.find(
        (transition) => transition.entityType === 'category' && transition.id === category.id
      )
      /** Markdown transition updating only its in-memory content path. */
      const contentTransition = storageTransitions.find(
        (transition) =>
          transition.entityType === contentEntityType && transition.id === content.id
      )
      expect(rootTransition).toMatchObject({
        persistenceMode: 'stage',
        after: { persistenceFields: { folderPath: 'RenamedRoot' } }
      })
      expect(categoryTransition).toMatchObject({
        persistenceMode: 'metadataOnly',
        after: { persistenceFields: { rootFolderName: 'RenamedRoot' } }
      })
      expect(contentTransition).toMatchObject({
        persistenceMode: 'metadataOnly',
        after: {
          persistenceFields: {
            folderPath:
              kind === 'template'
                ? 'RenamedRoot'
                : `RenamedRoot\\${location === 'completed' ? 'Completed' : 'Active'}`
          }
        }
      })
    }
  )

  it('applies an update recipe once and retains complete before and after nodes', () => {
    /** Current category record projected by one recipe-based update. */
    const category = { id: 'category', displayName: 'Before', description: null }
    mockDomainData.seed('category', category.id, category, {
      workspaceId: 'workspace',
      workspacePath: 'C:\\Workspace',
      rootPromptFolderId: 'Root',
      rootFolderName: 'Root',
      kind: 'prompt',
      categoryStem: 'Before',
      needsFilenameIdSuffix: false
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
    const plan = planPromptMove(createMainLikeDomainState(), {
      sourcePromptFolderId: source.id,
      destinationPromptFolderId: destination.id,
      contentId: 'moving',
      categoryId: null,
      previousEntryId: 'sibling'
    })
    expect(Array.isArray(plan)).toBe(true)
    if (!Array.isArray(plan)) return
    /** Immutable projection produced by applying each movement recipe once. */
    const projection = projectDomainTransitions(plan, [])
    /** Storage transitions including the non-domain sibling filename adjustment. */
    const storageTransitions = planDomainStorageTransitions(
      projection.beforeGraph,
      projection.afterGraph,
      projection.transitions
    )
    /** Moved prompt storage transition with its derived destination metadata. */
    const moving = storageTransitions.find(
      (change) => change.entityType === 'prompt' && change.id === 'moving'
    )
    /** Same-title destination sibling adjusted only by the storage diff. */
    const sibling = storageTransitions.find(
      (change) => change.entityType === 'prompt' && change.id === 'sibling'
    )
    expect(moving).toMatchObject({
      after: {
        persistenceFields: {
          promptFolderId: destination.id,
          needsFilenameIdSuffix: true
        }
      }
    })
    expect(sibling).toMatchObject({
      after: { persistenceFields: { needsFilenameIdSuffix: true } }
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
    /** Immutable deletion projection used by category storage adapters. */
    const projection = projectDomainTransitions(plan, [])
    /** Storage-only transition for the surviving category filename. */
    const survivor = planDomainStorageTransitions(
      projection.beforeGraph,
      projection.afterGraph,
      projection.transitions
    ).find(
      (change) => change.entityType === 'category' && change.id === 'survivor'
    )
    expect(survivor).toMatchObject({
      after: {
        persistenceFields: {
          categoryStem: 'Same',
          needsFilenameIdSuffix: false
        }
      }
    })
    expect(plan.some((change) => change.id === 'survivor')).toBe(false)
  })

  it('derives category insertion and colliding sibling storage without placeholders', () => {
    /** Root that owns one category at the inserted category's sanitized filename boundary. */
    const root = createRootFolder('Root', 'prompt', [], ['existing'])
    mockDomainData.seed(
      'promptFolder',
      root.id,
      root,
      createFolderPersistenceFields(root.id, 'prompt')
    )
    mockDomainData.seed(
      'category',
      'existing',
      { id: 'existing', displayName: 'Same?', description: null },
      {
        workspaceId: 'workspace',
        workspacePath: 'C:\\Workspace',
        rootPromptFolderId: root.id,
        rootFolderName: root.id,
        kind: 'prompt',
        categoryStem: 'Same',
        needsFilenameIdSuffix: false
      }
    )
    /** Shared category insertion plan projected by the main process. */
    const plan = planCreateCategoryDomainMutation(createMainLikeDomainState(), {
      categoryId: 'created',
      promptFolderId: root.id,
      displayName: 'Same*'
    })
    expect(Array.isArray(plan)).toBe(true)
    if (!Array.isArray(plan)) return
    /** Insert transition whose before side proves authoritative absence. */
    const projection = projectDomainTransitions(plan, [
      { entityType: 'promptFolder', id: root.id, expected: 'revision', revision: 1 },
      { entityType: 'category', id: 'created', expected: 'absent' }
    ])
    /** Inserted category domain transition before storage planning. */
    const insertion = projection.transitions.find(
      (transition) => transition.entityType === 'category' && transition.id === 'created'
    )
    /** Desired storage transitions calculated after complete filename planning. */
    const storageTransitions = planDomainStorageTransitions(
      projection.beforeGraph,
      projection.afterGraph,
      projection.transitions
    )
    /** Inserted category storage transition with its graph-derived filename. */
    const storage = storageTransitions.find(
      (transition) => transition.entityType === 'category' && transition.id === 'created'
    )
    /** Existing category storage transition caused only by the new collision. */
    const siblingStorage = storageTransitions.find(
      (transition) => transition.entityType === 'category' && transition.id === 'existing'
    )
    expect(insertion).toMatchObject({ before: null, expectedRevision: 0 })
    expect(insertion?.after?.persistenceFields).toBeNull()
    expect(storage).toMatchObject({
      before: null,
      after: {
        persistenceFields: {
          rootPromptFolderId: root.id,
          categoryStem: 'Same-created',
          needsFilenameIdSuffix: true
        }
      }
    })
    expect(siblingStorage).toMatchObject({
      after: {
        persistenceFields: {
          categoryStem: 'Same-existing',
          needsFilenameIdSuffix: true
        }
      }
    })
  })
})
