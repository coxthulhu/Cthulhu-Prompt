import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  PromptStatus,
  PromptStatusFolderId,
  createPromptSummary
} from '@shared/Prompt'
import { createPromptStatusFolderLayouts } from '@shared/PromptFolder'
import { createPromptTemplateFull } from '@shared/PromptTemplate'
import { categoryCollection } from '@renderer/data/Collections/CategoryCollection'
import { promptCollection } from '@renderer/data/Collections/PromptCollection'
import { promptClientStateCollection } from '@renderer/data/Collections/PromptClientStateCollection'
import { promptFolderCollection } from '@renderer/data/Collections/PromptFolderCollection'
import { promptTemplateCollection } from '@renderer/data/Collections/PromptTemplateCollection'
import { promptTemplateClientStateCollection } from '@renderer/data/Collections/PromptTemplateClientStateCollection'
import { workspaceCollection } from '@renderer/data/Collections/WorkspaceCollection'

/** Shared revision mutation mock exposes the deletion transaction contract. */
const runRevisionMutation = vi.hoisted(() => vi.fn())

vi.mock('@renderer/data/IpcFramework/RevisionCollections', () => ({ runRevisionMutation }))

import {
  createCategory,
  deleteCategory,
  moveCategory
} from '@renderer/data/Mutations/CategoryMutations'

/** Stable category ID referenced across prompt and template content. */
const CATEGORY_ID = 'category-delete-test'
/** Second stable category used to verify relative group movement. */
const SIBLING_CATEGORY_ID = 'category-a'
/** Stable category owner ID used by the deletion payload. */
const ROOT_FOLDER_ID = 'category-delete-root'
/** Stable prompt ID affected by deletion. */
const PROMPT_ID = 'category-delete-prompt'
/** Stable template ID affected by deletion. */
const TEMPLATE_ID = 'category-delete-template'
/** Stable workspace ID owning the category root. */
const WORKSPACE_ID = 'category-delete-workspace'

describe('category mutations', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    vi.clearAllMocks()
    categoryCollection.utils.deleteAuthoritative(CATEGORY_ID)
    categoryCollection.utils.deleteAuthoritative(SIBLING_CATEGORY_ID)
    promptFolderCollection.utils.deleteAuthoritative(ROOT_FOLDER_ID)
    promptCollection.utils.deleteAuthoritative(PROMPT_ID)
    promptTemplateCollection.utils.deleteAuthoritative(TEMPLATE_ID)
    workspaceCollection.utils.deleteAuthoritative(WORKSPACE_ID)
    if (promptClientStateCollection.has(PROMPT_ID)) promptClientStateCollection.delete(PROMPT_ID)
    if (promptTemplateClientStateCollection.has(TEMPLATE_ID)) {
      promptTemplateClientStateCollection.delete(TEMPLATE_ID)
    }

    categoryCollection.utils.upsertAuthoritative({
      id: CATEGORY_ID,
      revision: 2,
      data: { id: CATEGORY_ID, displayName: 'Shared', description: null }
    })
    categoryCollection.utils.upsertAuthoritative({
      id: SIBLING_CATEGORY_ID,
      revision: 1,
      data: { id: SIBLING_CATEGORY_ID, displayName: 'Sibling', description: null }
    })
    promptFolderCollection.utils.upsertAuthoritative({
      id: ROOT_FOLDER_ID,
      revision: 3,
      data: {
        id: ROOT_FOLDER_ID,
        kind: 'prompt',
        folderName: 'Root',
        displayName: 'Root',
        statusFolders: createPromptStatusFolderLayouts({
          categoryOrders: {
            [PromptStatusFolderId.Active]: {
              categories: [
                { categoryId: null, entries: [] },
                { categoryId: CATEGORY_ID, entries: [{ kind: 'prompt', id: PROMPT_ID }] }
              ]
            }
          }
        }),
        settings: { folderDescription: null }
      }
    })
    workspaceCollection.utils.upsertAuthoritative({
      id: WORKSPACE_ID,
      revision: 1,
      data: {
        id: WORKSPACE_ID,
        workspacePath: 'C:\\Workspace',
        workspaceName: 'Workspace',
        entries: [{ kind: 'folder', id: ROOT_FOLDER_ID }]
      }
    })
    promptCollection.utils.upsertAuthoritative({
      id: PROMPT_ID,
      revision: 4,
      data: createPromptSummary({
        id: PROMPT_ID,
        title: 'Prompt',
        fallbackTitle: '',
        modifiedAt: '2026-01-01T00:00:00.000Z',
        category: CATEGORY_ID,
        status: PromptStatus.Todo
      })
    })
    promptTemplateCollection.utils.upsertAuthoritative({
      id: TEMPLATE_ID,
      revision: 5,
      data: createPromptTemplateFull({
        id: TEMPLATE_ID,
        title: 'Template',
        fallbackTitle: '',
        createdAt: '2026-01-01T00:00:00.000Z',
        modifiedAt: '2026-01-01T00:00:00.000Z',
        category: CATEGORY_ID,
        templateText: 'Template text.'
      })
    })
    runRevisionMutation.mockResolvedValue(undefined)
  })

  it('sends an absent expectation for the optimistic category insertion', async () => {
    /** Stable category ID returned by the renderer mutation. */
    const categoryId = await createCategory(ROOT_FOLDER_ID, 'Created')
    /** Domain mutation options registered by category creation. */
    const options = runRevisionMutation.mock.calls[0]?.[0]
    /** Mutable root order used to verify the shared optimistic folder recipe. */
    const folderState = structuredClone(promptFolderCollection.get(ROOT_FOLDER_ID)!)
    /** Optimistic category insertion spy. */
    const insertCategoryOptimistically = vi.fn()
    options.mutateOptimistically({
      collections: {
        promptFolder: {
          update: (id: string, update: (draft: typeof folderState) => void) => {
            expect(id).toBe(ROOT_FOLDER_ID)
            update(folderState)
          }
        },
        category: { insert: insertCategoryOptimistically }
      }
    })
    expect(
      folderState.statusFolders[PromptStatusFolderId.Active].categoryOrder.categories[1]
        ?.categoryId
    ).toBe(categoryId)
    expect(insertCategoryOptimistically).toHaveBeenCalledWith({
      id: categoryId,
      displayName: 'Created',
      description: null
    })

    /** IPC invocation spy used to inspect the generic domain request. */
    const invoke = vi.fn().mockResolvedValue({ success: false, error: 'inspect only' })
    await options.persistMutations({ invoke, transaction: {} })
    expect(invoke).toHaveBeenCalledWith('create-category', {
      payload: {
        command: {
          categoryId,
          promptFolderId: ROOT_FOLDER_ID,
          displayName: 'Created'
        },
        expectations: [
          {
            entityType: 'promptFolder',
            id: ROOT_FOLDER_ID,
            expected: 'revision',
            revision: 3
          },
          {
            entityType: 'category',
            id: categoryId,
            expected: 'absent'
          }
        ]
      }
    })

    /** Authoritative reconciliation spies kept side-effect free for test isolation. */
    const upsertFolder = vi
      .spyOn(promptFolderCollection.utils, 'upsertAuthoritative')
      .mockImplementation(() => undefined)
    const upsertCategory = vi
      .spyOn(categoryCollection.utils, 'upsertAuthoritative')
      .mockImplementation(() => undefined)
    options.handleSuccessOrConflictResponse({
      snapshots: [
        {
          entityType: 'promptFolder',
          id: ROOT_FOLDER_ID,
          revision: 4,
          data: {
            ...promptFolderCollection.get(ROOT_FOLDER_ID),
            statusFolders: folderState.statusFolders
          }
        },
        {
          entityType: 'category',
          id: categoryId,
          revision: 1,
          data: { id: categoryId, displayName: 'Created', description: null }
        }
      ]
    })
    expect(upsertFolder).toHaveBeenCalledOnce()
    expect(upsertCategory).toHaveBeenCalledOnce()
  })

  it('clears every matching renderer reference and sends all touched revisions', async () => {
    await deleteCategory(CATEGORY_ID)

    /** Revision mutation options registered by deleteCategory. */
    const options = runRevisionMutation.mock.calls[0]?.[0]
    /** Mutable folder state used to observe the optimistic recipe. */
    const folderState = structuredClone(promptFolderCollection.get(ROOT_FOLDER_ID)!)
    /** Mutable prompt state used to observe category and timestamp cleanup. */
    const promptState = {
      id: PROMPT_ID,
      category: CATEGORY_ID,
      modifiedAt: '2026-01-01T00:00:00.000Z'
    }
    /** Mutable template state used to observe category and timestamp cleanup. */
    const templateState = {
      id: TEMPLATE_ID,
      category: CATEGORY_ID,
      modifiedAt: '2026-01-01T00:00:00.000Z'
    }
    /** Category deletion spy verifies optimistic removal. */
    const deleteCategoryOptimistically = vi.fn()

    options.mutateOptimistically({
      collections: {
        promptFolder: {
          update: (id: string, update: (draft: typeof folderState) => void) => {
            expect(id).toBe(ROOT_FOLDER_ID)
            update(folderState)
          }
        },
        category: { delete: deleteCategoryOptimistically },
        prompt: {
          update: (id: string, update: (draft: typeof promptState) => void) => {
            expect(id).toBe(PROMPT_ID)
            update(promptState)
          }
        },
        promptTemplate: {
          update: (id: string, update: (draft: typeof templateState) => void) => {
            expect(id).toBe(TEMPLATE_ID)
            update(templateState)
          }
        }
      }
    })

    expect(
      folderState.statusFolders[PromptStatusFolderId.Active].categoryOrder.categories
    ).toEqual([
      { categoryId: null, entries: [{ kind: 'prompt', id: PROMPT_ID }] }
    ])
    expect(deleteCategoryOptimistically).toHaveBeenCalledWith(CATEGORY_ID)
    expect(promptState).not.toHaveProperty('category')
    expect(templateState).not.toHaveProperty('category')
    expect(promptState.modifiedAt).not.toBe('2026-01-01T00:00:00.000Z')
    expect(templateState.modifiedAt).toBe(promptState.modifiedAt)

    /** IPC invocation spy returns a persistence failure before reconciliation. */
    const invoke = vi.fn().mockResolvedValue({ success: false, error: 'stop before commit' })
    await options.persistMutations({ invoke, transaction: {} })
    expect(invoke).toHaveBeenCalledWith('delete-category', {
      payload: {
        command: {
          categoryId: CATEGORY_ID,
          promptFolderId: ROOT_FOLDER_ID,
          workspaceId: WORKSPACE_ID,
          modifiedAt: promptState.modifiedAt
        },
        expectations: [
          {
            entityType: 'promptFolder',
            id: ROOT_FOLDER_ID,
            expected: 'revision',
            revision: 3
          },
          {
            entityType: 'category',
            id: CATEGORY_ID,
            expected: 'revision',
            revision: 2
          },
          {
            entityType: 'prompt',
            id: PROMPT_ID,
            expected: 'revision',
            revision: 4
          },
          {
            entityType: 'promptTemplate',
            id: TEMPLATE_ID,
            expected: 'revision',
            revision: 5
          }
        ]
      }
    })
  })

  it('reconciles authoritative records and preserves edit markers after deletion', async () => {
    promptClientStateCollection.insert({ id: PROMPT_ID, isEdited: true })
    promptTemplateClientStateCollection.insert({ id: TEMPLATE_ID, isEdited: true })
    await deleteCategory(CATEGORY_ID)

    /** Revision mutation options registered by deleteCategory. */
    const options = runRevisionMutation.mock.calls[0]?.[0]
    /** Successful authoritative payload returned by category deletion. */
    const payload = {
      snapshots: [
        {
          entityType: 'promptFolder',
          id: ROOT_FOLDER_ID,
          revision: 4,
          data: {
            ...promptFolderCollection.get(ROOT_FOLDER_ID)!,
            statusFolders: createPromptStatusFolderLayouts({
              categoryOrders: {
                [PromptStatusFolderId.Active]: {
                  categories: [
                    { categoryId: null, entries: [{ kind: 'prompt', id: PROMPT_ID }] }
                  ]
                }
              }
            })
          }
        },
        { entityType: 'category', id: CATEGORY_ID, deleted: true },
        {
          entityType: 'prompt',
          id: PROMPT_ID,
          revision: 5,
          data: {
            id: PROMPT_ID,
            title: 'Prompt',
            fallbackTitle: '',
            createdAt: '2026-01-01T00:00:00.000Z',
            modifiedAt: '2026-08-16T12:00:00.000Z',
            promptText: 'Prompt text.',
            status: PromptStatus.Todo
          }
        },
        {
          entityType: 'promptTemplate',
          id: TEMPLATE_ID,
          revision: 6,
          data: {
            id: TEMPLATE_ID,
            title: 'Template',
            fallbackTitle: '',
            createdAt: '2026-01-01T00:00:00.000Z',
            modifiedAt: '2026-08-16T12:00:00.000Z',
            templateText: 'Template text.'
          }
        },
        {
          entityType: 'workspacePromptFolderUiState',
          id: `${WORKSPACE_ID}:${CATEGORY_ID}`,
          deleted: true
        },
        {
          entityType: 'categoryDescriptionEditorUiState',
          id: `${WORKSPACE_ID}:${CATEGORY_ID}`,
          deleted: true
        }
      ]
    }
    /** Successful IPC invocation spy returns the authoritative deletion graph. */
    const invoke = vi.fn().mockResolvedValue({ success: true, payload })
    await options.persistMutations({ invoke, transaction: {} })

    options.handleSuccessOrConflictResponse(payload)
    expect(categoryCollection.get(CATEGORY_ID)).toBeUndefined()
    expect(
      promptFolderCollection.get(ROOT_FOLDER_ID)?.kind === 'prompt'
        ? promptFolderCollection.get(ROOT_FOLDER_ID)?.statusFolders[
            PromptStatusFolderId.Active
          ].categoryOrder.categories
        : undefined
    ).toEqual([
      { categoryId: null, entries: [{ kind: 'prompt', id: PROMPT_ID }] }
    ])
    expect(promptClientStateCollection.get(PROMPT_ID)).toMatchObject({
      id: PROMPT_ID,
      isEdited: true
    })
    expect(promptTemplateClientStateCollection.get(TEMPLATE_ID)).toMatchObject({
      id: TEMPLATE_ID,
      isEdited: true
    })
    expect(promptCollection.get(PROMPT_ID)).toMatchObject({
      loadingState: 'full',
      modifiedAt: '2026-08-16T12:00:00.000Z'
    })
    expect(promptTemplateCollection.get(TEMPLATE_ID)).toMatchObject({
      loadingState: 'full',
      modifiedAt: '2026-08-16T12:00:00.000Z'
    })
  })

  it('reorders a complete category group through one root-folder revision', async () => {
    promptFolderCollection.utils.upsertAuthoritative({
      id: ROOT_FOLDER_ID,
      revision: 4,
      data: {
        ...promptFolderCollection.get(ROOT_FOLDER_ID)!,
        statusFolders: createPromptStatusFolderLayouts({
          categoryOrders: {
            [PromptStatusFolderId.Active]: {
              categories: [
                { categoryId: null, entries: [] },
                { categoryId: SIBLING_CATEGORY_ID, entries: [] },
                { categoryId: CATEGORY_ID, entries: [{ kind: 'prompt', id: PROMPT_ID }] }
              ]
            }
          }
        })
      }
    })

    await moveCategory(ROOT_FOLDER_ID, CATEGORY_ID, null)
    /** Revision mutation contract registered by category reorder. */
    const options = runRevisionMutation.mock.calls[0]?.[0]
    /** Mutable order used to observe the category-group recipe. */
    const folderState = structuredClone(promptFolderCollection.get(ROOT_FOLDER_ID)!)
    options.mutateOptimistically({
      collections: {
        promptFolder: {
          update: (_id: string, update: (draft: typeof folderState) => void) =>
            update(folderState)
        }
      }
    })

    expect(
      folderState.statusFolders[PromptStatusFolderId.Active].categoryOrder.categories.map(
        (group) => group.categoryId
      )
    ).toEqual([
      null,
      CATEGORY_ID,
      SIBLING_CATEGORY_ID
    ])
    expect(
      folderState.statusFolders[PromptStatusFolderId.Active].categoryOrder.categories[1]
        ?.entries
    ).toEqual([
      { kind: 'prompt', id: PROMPT_ID }
    ])
  })
})
