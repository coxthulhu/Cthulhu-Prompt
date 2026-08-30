import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { DomainState } from '@shared/DomainChanges'

const mockTransactionState = vi.hoisted(() => {
  const storeNames = [
    'systemSettings',
    'workspace',
    'promptFolder',
    'category',
    'prompt',
    'promptTemplate'
  ] as const
  type StoreName = (typeof storeNames)[number]
  type Entry = {
    revision: number
    committed: unknown
    persistenceFields: unknown
  }

  const entriesByStore: Record<StoreName, Map<string, Entry>> = {
    systemSettings: new Map(),
    workspace: new Map(),
    promptFolder: new Map(),
    category: new Map(),
    prompt: new Map(),
    promptTemplate: new Map()
  }
  /** Persistence staging counts recorded independently for each authoritative store. */
  const stageCounts = Object.fromEntries(
    storeNames.map((storeName) => [storeName, 0])
  ) as Record<StoreName, number>

  const reset = (): void => {
    for (const storeName of storeNames) {
      entriesByStore[storeName].clear()
      stageCounts[storeName] = 0
    }
  }

  const seedEntry = (store: StoreName, id: string, entry: Entry): void => {
    entriesByStore[store].set(id, entry)
  }

  const readEntry = (store: StoreName, id: string): Entry | null => {
    return entriesByStore[store].get(id) ?? null
  }

  /** Reads every committed test entry for one authoritative store. */
  const readEntries = (store: StoreName): Entry[] => [...entriesByStore[store].values()]

  const createCommittedStore = (store: StoreName) => {
    return {
      getRevision: (id: string) => entriesByStore[store].get(id)?.revision ?? 0,
      getEntry: (id: string) => entriesByStore[store].get(id) ?? null,
      getAllEntries: () => [...entriesByStore[store].values()],
      setFromDisk: (id: string, data: unknown, persistenceFields: unknown) => {
        entriesByStore[store].set(id, {
          revision: 0,
          committed: data,
          persistenceFields
        })
      },
      commitAfterWrite: (id: string, data: unknown, persistenceFields?: unknown) => {
        const entry = entriesByStore[store].get(id)
        if (!entry) {
          throw new Error(`Missing entry ${store}:${id}`)
        }

        const nextRevision = entry.revision + 1
        entriesByStore[store].set(id, {
          revision: nextRevision,
          committed: data,
          persistenceFields: persistenceFields ?? entry.persistenceFields
        })

        return nextRevision
      },
      updatePersistenceFields: (id: string, persistenceFields: unknown) => {
        const entry = entriesByStore[store].get(id)
        if (!entry) {
          throw new Error(`Missing entry ${store}:${id}`)
        }
        entriesByStore[store].set(id, { ...entry, persistenceFields })
      },
      remove: (id: string) => {
        entriesByStore[store].delete(id)
      }
    }
  }

  const createRevisionData = (store: StoreName) => {
    return {
      committedStore: createCommittedStore(store),
      persistence: {
        stageChanges: async (_change: unknown) => {
          stageCounts[store] += 1
          return { stagedChange: [] }
        },
        commitChanges: async (_stagedChange: unknown) => undefined,
        revertChanges: async (_stagedChange: unknown) => undefined,
        loadData: async (_persistenceFields: unknown) => null
      },
      loadDataFromPersistence: async (_id: string, _persistenceFields: unknown) => undefined,
      emitCommittedRevisionChanged: (_id: string) => undefined
    }
  }

  return {
    data: {
      systemSettings: createRevisionData('systemSettings'),
      workspace: createRevisionData('workspace'),
      promptFolder: createRevisionData('promptFolder'),
      category: createRevisionData('category'),
      prompt: createRevisionData('prompt'),
      promptTemplate: createRevisionData('promptTemplate')
    },
    reset,
    seedEntry,
    readEntry,
    readEntries,
    stageCounts
  }
})

/** Main mutation queue spy used to distinguish queued and immediate atomic modes. */
const enqueueGlobalMutation = vi.hoisted(() =>
  vi.fn(async <TResult>(mutation: () => Promise<TResult>): Promise<TResult> => await mutation())
)

vi.mock('../../src/main/Data/Data', () => {
  return {
    data: mockTransactionState.data
  }
})

vi.mock('../../src/main/Data/GlobalMutationQueue', () => {
  return { enqueueGlobalMutation }
})

import { planCreateCategoryDomainMutation } from '@shared/CategoryDomainMutations'
import { planRenamePromptFolderDomainMutation } from '@shared/PromptFolderDomainMutations'
import {
  runAtomicDataTransaction,
  runAtomicDomainTransitionTransaction
} from '../../src/main/Data/AtomicDataTransaction'
import { projectDomainTransitions } from '../../src/main/Data/DomainTransitions'

const SYSTEM_SETTINGS_ID = 'system-settings'
const PROMPT_ID = 'prompt-1'

describe('atomic data transaction', () => {
  beforeEach(() => {
    mockTransactionState.reset()
    enqueueGlobalMutation.mockClear()
  })

  it('commits a compatibility create through a null-before transition', async () => {
    /** Created prompt data supplied through the legacy builder wrapper. */
    const prompt = { id: PROMPT_ID, title: 'Created' }
    /** Compatibility transaction projected into the transition-native core. */
    const outcome = await runAtomicDataTransaction((tx) => ({
      prompt: tx.prompt.create({
        id: PROMPT_ID,
        data: prompt,
        persistenceFields: { promptStem: 'Created' }
      })
    }))
    expect(outcome).toMatchObject({
      status: 'success',
      results: { prompt: { id: PROMPT_ID, revision: 1, data: prompt } }
    })
    expect(mockTransactionState.readEntry('prompt', PROMPT_ID)).toEqual({
      revision: 1,
      committed: prompt,
      persistenceFields: { promptStem: 'Created' }
    })
  })

  it('commits a domain insertion with graph-derived storage metadata', async () => {
    /** Workspace and root folder graph required to derive category storage. */
    const workspace = {
      id: 'workspace',
      workspacePath: 'C:\\Workspace',
      workspaceName: 'Workspace',
      entries: [{ kind: 'folder' as const, id: 'root' }]
    }
    /** Root folder updated to own the inserted category. */
    const promptFolder = {
      id: 'root',
      kind: 'prompt' as const,
      folderName: 'Root',
      displayName: 'Root',
      completedPromptIds: [],
      categoryOrder: { categories: [{ categoryId: null, entries: [] }] },
      settings: { folderDescription: null }
    }
    mockTransactionState.seedEntry('workspace', workspace.id, {
      revision: 1,
      committed: workspace,
      persistenceFields: {
        workspacePath: workspace.workspacePath,
        workspaceInfoPath: 'C:\\Workspace\\Workspace.cthulhuprompt.json'
      }
    })
    mockTransactionState.seedEntry('promptFolder', promptFolder.id, {
      revision: 1,
      committed: promptFolder,
      persistenceFields: {
        workspaceId: workspace.id,
        workspacePath: workspace.workspacePath,
        folderName: promptFolder.folderName,
        folderPath: promptFolder.folderName,
        kind: promptFolder.kind
      }
    })
    /** Main-like domain state backed by the seeded committed graph. */
    const state = {
      get: (entityType: 'promptFolder', id: string) =>
        entityType === 'promptFolder' && id === promptFolder.id ? promptFolder : undefined,
      getAll: () => []
    } as unknown as DomainState
    /** Shared category creation plan containing one update and one insert. */
    const plan = planCreateCategoryDomainMutation(state, {
      categoryId: 'created',
      promptFolderId: promptFolder.id,
      displayName: 'Created'
    })
    expect(Array.isArray(plan)).toBe(true)
    if (!Array.isArray(plan)) return
    /** Projected transition transaction with explicit present and absent expectations. */
    const projection = projectDomainTransitions(plan, [
      { entityType: 'promptFolder', id: promptFolder.id, expected: 'revision', revision: 1 },
      { entityType: 'category', id: 'created', expected: 'absent' }
    ])
    const outcome = await runAtomicDomainTransitionTransaction(projection, {
      mode: 'immediate'
    })
    expect(outcome.status).toBe('success')
    expect(mockTransactionState.readEntry('category', 'created')).toEqual({
      revision: 1,
      committed: { id: 'created', displayName: 'Created', description: null },
      persistenceFields: {
        workspaceId: workspace.id,
        workspacePath: workspace.workspacePath,
        rootPromptFolderId: promptFolder.id,
        rootFolderName: promptFolder.folderName,
        kind: promptFolder.kind,
        categoryStem: 'Created',
        needsFilenameIdSuffix: false
      }
    })
  })

  it('renames one root directory while retaining descendant revisions', async () => {
    /** Workspace owning the renamed prompt root. */
    const workspace = {
      id: 'workspace',
      workspacePath: 'C:\\Workspace',
      workspaceName: 'Workspace',
      entries: [{ kind: 'folder' as const, id: 'root' }]
    }
    /** Prompt root containing one category and one active prompt. */
    const promptFolder = {
      id: 'root',
      kind: 'prompt' as const,
      folderName: 'Root',
      displayName: 'Root',
      completedPromptIds: [],
      categoryOrder: {
        categories: [
          { categoryId: null, entries: [] },
          { categoryId: 'category', entries: [{ kind: 'prompt' as const, id: 'prompt' }] }
        ]
      },
      settings: { folderDescription: null }
    }
    /** Category stored beneath the renamed root. */
    const category = { id: 'category', displayName: 'Category', description: null }
    /** Prompt markdown stored beneath the renamed root's active directory. */
    const prompt = {
      id: 'prompt',
      title: 'Prompt',
      fallbackTitle: '',
      createdAt: 'created',
      modifiedAt: 'modified',
      promptText: 'content',
      status: 'todo'
    }
    mockTransactionState.seedEntry('workspace', workspace.id, {
      revision: 1,
      committed: workspace,
      persistenceFields: {
        workspacePath: workspace.workspacePath,
        workspaceInfoPath: 'C:\\Workspace\\Workspace.cthulhuprompt.json'
      }
    })
    mockTransactionState.seedEntry('promptFolder', promptFolder.id, {
      revision: 4,
      committed: promptFolder,
      persistenceFields: {
        workspaceId: workspace.id,
        workspacePath: workspace.workspacePath,
        folderName: promptFolder.folderName,
        folderPath: promptFolder.folderName,
        kind: promptFolder.kind
      }
    })
    mockTransactionState.seedEntry('category', category.id, {
      revision: 7,
      committed: category,
      persistenceFields: {
        workspaceId: workspace.id,
        workspacePath: workspace.workspacePath,
        rootPromptFolderId: promptFolder.id,
        rootFolderName: promptFolder.folderName,
        kind: promptFolder.kind,
        categoryStem: category.displayName,
        needsFilenameIdSuffix: false
      }
    })
    mockTransactionState.seedEntry('prompt', prompt.id, {
      revision: 9,
      committed: prompt,
      persistenceFields: {
        workspaceId: workspace.id,
        workspacePath: workspace.workspacePath,
        folderPath: 'Root\\Active',
        promptFolderId: promptFolder.id,
        promptId: prompt.id,
        promptStem: prompt.title,
        needsFilenameIdSuffix: false
      }
    })
    /** Domain state backed by the same committed entries used by the atomic transaction. */
    const state: DomainState = {
      get: (entityType, id) =>
        mockTransactionState.readEntry(entityType, id)?.committed as never,
      getAll: (entityType) =>
        mockTransactionState.readEntries(entityType).map((entry) => entry.committed) as never
    }
    /** Shared rename plan whose descendants are storage-only transitions. */
    const plan = planRenamePromptFolderDomainMutation(state, {
      promptFolderId: promptFolder.id,
      displayName: 'Renamed Root'
    })
    expect(Array.isArray(plan)).toBe(true)
    if (!Array.isArray(plan)) return
    /** Projected rename with concurrency protection only on the root folder. */
    const projection = projectDomainTransitions(plan, [
      { entityType: 'promptFolder', id: promptFolder.id, expected: 'revision', revision: 4 }
    ])
    /** Atomic result after one physical root write and metadata-only descendant updates. */
    const outcome = await runAtomicDomainTransitionTransaction(projection, {
      mode: 'immediate'
    })
    expect(outcome.status).toBe('success')
    expect(mockTransactionState.readEntry('promptFolder', promptFolder.id)).toMatchObject({
      revision: 5,
      committed: { displayName: 'Renamed Root', folderName: 'RenamedRoot' },
      persistenceFields: { folderPath: 'RenamedRoot' }
    })
    expect(mockTransactionState.readEntry('category', category.id)).toMatchObject({
      revision: 7,
      persistenceFields: { rootFolderName: 'RenamedRoot' }
    })
    expect(mockTransactionState.readEntry('prompt', prompt.id)).toMatchObject({
      revision: 9,
      persistenceFields: { folderPath: 'RenamedRoot\\Active' }
    })
    expect(mockTransactionState.stageCounts).toEqual({
      systemSettings: 0,
      workspace: 0,
      promptFolder: 1,
      category: 0,
      prompt: 0,
      promptTemplate: 0
    })
  })

  it('retains a template revision while renaming its root directory', async () => {
    /** Workspace owning the renamed template root. */
    const workspace = {
      id: 'workspace',
      workspacePath: 'C:\\Workspace',
      workspaceName: 'Workspace',
      entries: [{ kind: 'folder' as const, id: 'templates' }]
    }
    /** Template root containing one active template. */
    const promptFolder = {
      id: 'templates',
      kind: 'template' as const,
      folderName: 'Templates',
      displayName: 'Templates',
      completedPromptIds: [],
      categoryOrder: {
        categories: [
          {
            categoryId: null,
            entries: [{ kind: 'template' as const, id: 'template' }]
          }
        ]
      },
      settings: { folderDescription: null }
    }
    /** Template markdown stored directly beneath its root directory. */
    const promptTemplate = {
      id: 'template',
      title: 'Template',
      fallbackTitle: '',
      createdAt: 'created',
      modifiedAt: 'modified',
      promptText: 'content'
    }
    mockTransactionState.seedEntry('workspace', workspace.id, {
      revision: 1,
      committed: workspace,
      persistenceFields: {
        workspacePath: workspace.workspacePath,
        workspaceInfoPath: 'C:\\Workspace\\Workspace.cthulhuprompt.json'
      }
    })
    mockTransactionState.seedEntry('promptFolder', promptFolder.id, {
      revision: 2,
      committed: promptFolder,
      persistenceFields: {
        workspaceId: workspace.id,
        workspacePath: workspace.workspacePath,
        folderName: promptFolder.folderName,
        folderPath: promptFolder.folderName,
        kind: promptFolder.kind
      }
    })
    mockTransactionState.seedEntry('promptTemplate', promptTemplate.id, {
      revision: 6,
      committed: promptTemplate,
      persistenceFields: {
        workspaceId: workspace.id,
        workspacePath: workspace.workspacePath,
        folderPath: promptFolder.folderName,
        promptFolderId: promptFolder.id,
        promptId: promptTemplate.id,
        promptStem: promptTemplate.title,
        needsFilenameIdSuffix: false
      }
    })
    /** Domain state backed by the seeded template-root graph. */
    const state: DomainState = {
      get: (entityType, id) =>
        mockTransactionState.readEntry(entityType, id)?.committed as never,
      getAll: (entityType) =>
        mockTransactionState.readEntries(entityType).map((entry) => entry.committed) as never
    }
    /** Shared template-root rename plan. */
    const plan = planRenamePromptFolderDomainMutation(state, {
      promptFolderId: promptFolder.id,
      displayName: 'Renamed Templates'
    })
    expect(Array.isArray(plan)).toBe(true)
    if (!Array.isArray(plan)) return
    /** Projected rename carrying a revision expectation only for the root. */
    const projection = projectDomainTransitions(plan, [
      { entityType: 'promptFolder', id: promptFolder.id, expected: 'revision', revision: 2 }
    ])
    /** Atomic template-root rename result. */
    const outcome = await runAtomicDomainTransitionTransaction(projection, {
      mode: 'immediate'
    })
    expect(outcome.status).toBe('success')
    expect(mockTransactionState.readEntry('promptFolder', promptFolder.id)).toMatchObject({
      revision: 3,
      persistenceFields: { folderPath: 'RenamedTemplates' }
    })
    expect(
      mockTransactionState.readEntry('promptTemplate', promptTemplate.id)
    ).toMatchObject({
      revision: 6,
      persistenceFields: { folderPath: 'RenamedTemplates' }
    })
    expect(mockTransactionState.stageCounts).toEqual({
      systemSettings: 0,
      workspace: 0,
      promptFolder: 1,
      category: 0,
      prompt: 0,
      promptTemplate: 0
    })
  })

  it('returns labeled committed results with data for updates and deletes', async () => {
    mockTransactionState.seedEntry('systemSettings', SYSTEM_SETTINGS_ID, {
      revision: 1,
      committed: {
        promptFontSize: 16,
        promptEditorMinLines: 2,
        promptEditorMaxLines: 30,
        showLineNumbers: true
      },
      persistenceFields: {}
    })
    mockTransactionState.seedEntry('prompt', PROMPT_ID, {
      revision: 4,
      committed: { id: PROMPT_ID },
      persistenceFields: { folderName: 'Folder', workspacePath: 'C:\\Workspace' }
    })

    const outcome = await runAtomicDataTransaction((tx) => {
      return {
        systemSettings: tx.systemSettings.update({
          id: SYSTEM_SETTINGS_ID,
          expectedRevision: 1,
          recipe: (draft) => {
            draft.promptFontSize = 22
          }
        }),
        prompt: tx.prompt.delete({
          id: PROMPT_ID,
          expectedRevision: 4
        })
      }
    })

    expect(outcome.status).toBe('success')
    if (outcome.status !== 'success') {
      return
    }

    expect(outcome.results.systemSettings.revision).toBe(2)
    expect(outcome.results.systemSettings.data).toEqual({
      promptFontSize: 22,
      promptEditorMinLines: 2,
      promptEditorMaxLines: 30,
      showLineNumbers: true
    })
    expect(outcome.results.prompt.revision).toBeNull()
    expect(outcome.results.prompt.data).toBeNull()
    expect(mockTransactionState.readEntry('prompt', PROMPT_ID)).toBeNull()
  })

  it('returns a CAS conflict result when expected revision does not match', async () => {
    mockTransactionState.seedEntry('systemSettings', SYSTEM_SETTINGS_ID, {
      revision: 7,
      committed: {
        promptFontSize: 18,
        promptEditorMinLines: 4,
        promptEditorMaxLines: 30,
        showLineNumbers: true
      },
      persistenceFields: {}
    })

    const outcome = await runAtomicDataTransaction((tx) => {
      return {
        systemSettings: tx.systemSettings.update({
          id: SYSTEM_SETTINGS_ID,
          expectedRevision: 6,
          recipe: (draft) => {
            draft.promptEditorMinLines = 8
          }
        })
      }
    })

    expect(outcome.status).toBe('conflict')
    if (outcome.status !== 'conflict') {
      return
    }

    expect(outcome.conflictLabel).toBe('systemSettings')
    expect(outcome.conflicts).toEqual({
      systemSettings: {
        store: 'systemSettings',
        id: SYSTEM_SETTINGS_ID,
        expectedRevision: 6,
        actualRevision: 7,
        data: {
          promptFontSize: 18,
          promptEditorMinLines: 4,
          promptEditorMaxLines: 30,
          showLineNumbers: true
        }
      }
    })
  })

  it('updates persistence fields without incrementing the entity revision', async () => {
    mockTransactionState.seedEntry('prompt', PROMPT_ID, {
      revision: 4,
      committed: { id: PROMPT_ID, title: 'Duplicate title' },
      persistenceFields: {
        promptStem: 'Duplicate title',
        needsFilenameIdSuffix: false
      }
    })

    const outcome = await runAtomicDataTransaction((tx) => ({
      promptFilename: tx.prompt.updatePersistenceFields({
        id: PROMPT_ID,
        persistenceFields: {
          promptStem: 'Duplicate title-prompt-1',
          needsFilenameIdSuffix: true
        }
      })
    }))

    expect(outcome.status).toBe('success')
    if (outcome.status !== 'success') return

    expect(outcome.results.promptFilename).toMatchObject({
      revision: 4,
      data: { id: PROMPT_ID, title: 'Duplicate title' }
    })
    expect(mockTransactionState.readEntry('prompt', PROMPT_ID)).toEqual({
      revision: 4,
      committed: { id: PROMPT_ID, title: 'Duplicate title' },
      persistenceFields: {
        promptStem: 'Duplicate title-prompt-1',
        needsFilenameIdSuffix: true
      }
    })
  })

  it('commits immediately without entering the global mutation queue', async () => {
    mockTransactionState.seedEntry('systemSettings', SYSTEM_SETTINGS_ID, {
      revision: 1,
      committed: {
        promptFontSize: 16,
        promptEditorMinLines: 2,
        promptEditorMaxLines: 30,
        showLineNumbers: true
      },
      persistenceFields: {}
    })

    /** Immediate result committed by a caller that already owns the global queue. */
    const outcome = await runAtomicDataTransaction(
      (tx) => ({
        systemSettings: tx.systemSettings.update({
          id: SYSTEM_SETTINGS_ID,
          recipe: (draft) => {
            draft.promptFontSize = 18
          }
        })
      }),
      { mode: 'immediate' }
    )

    expect(outcome.status).toBe('success')
    expect(enqueueGlobalMutation).not.toHaveBeenCalled()
    expect(
      mockTransactionState.readEntry('systemSettings', SYSTEM_SETTINGS_ID)?.committed
    ).toMatchObject({
      promptFontSize: 18
    })
  })
})
