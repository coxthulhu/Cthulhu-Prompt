import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PromptStatus, createPromptSummary } from '@shared/Prompt'
import { createPromptTemplateFull } from '@shared/PromptTemplate'
import { categoryCollection } from '@renderer/data/Collections/CategoryCollection'
import { promptCollection } from '@renderer/data/Collections/PromptCollection'
import { promptDraftCollection } from '@renderer/data/Collections/PromptDraftCollection'
import { promptFolderCollection } from '@renderer/data/Collections/PromptFolderCollection'
import { promptTemplateCollection } from '@renderer/data/Collections/PromptTemplateCollection'
import { promptTemplateDraftCollection } from '@renderer/data/Collections/PromptTemplateDraftCollection'

/** Shared revision mutation mock exposes the deletion transaction contract. */
const runRevisionMutation = vi.hoisted(() => vi.fn())

vi.mock('@renderer/data/IpcFramework/RevisionCollections', () => ({ runRevisionMutation }))

import { deleteCategory } from '@renderer/data/Mutations/CategoryMutations'

/** Stable category ID referenced across prompt and template content. */
const CATEGORY_ID = 'category-delete-test'
/** Stable category owner ID used by the deletion payload. */
const ROOT_FOLDER_ID = 'category-delete-root'
/** Stable prompt ID affected by deletion. */
const PROMPT_ID = 'category-delete-prompt'
/** Stable template ID affected by deletion. */
const TEMPLATE_ID = 'category-delete-template'

describe('category mutations', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    vi.clearAllMocks()
    categoryCollection.utils.deleteAuthoritative(CATEGORY_ID)
    promptFolderCollection.utils.deleteAuthoritative(ROOT_FOLDER_ID)
    promptCollection.utils.deleteAuthoritative(PROMPT_ID)
    promptTemplateCollection.utils.deleteAuthoritative(TEMPLATE_ID)

    categoryCollection.utils.upsertAuthoritative({
      id: CATEGORY_ID,
      revision: 2,
      data: { id: CATEGORY_ID, displayName: 'Shared', description: null }
    })
    promptFolderCollection.utils.upsertAuthoritative({
      id: ROOT_FOLDER_ID,
      revision: 3,
      data: {
        id: ROOT_FOLDER_ID,
        kind: 'prompt',
        folderName: 'Root',
        displayName: 'Root',
        entries: [{ kind: 'prompt', id: PROMPT_ID }],
        completedPromptIds: [],
        categoryIds: [CATEGORY_ID],
        settings: { folderDescription: null }
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

  it('clears every matching renderer reference and sends category ownership revisions', async () => {
    await deleteCategory(CATEGORY_ID)

    /** Revision mutation options registered by deleteCategory. */
    const options = runRevisionMutation.mock.calls[0]?.[0]
    /** Mutable folder state used to observe the optimistic recipe. */
    const folderState = { categoryIds: [CATEGORY_ID] }
    /** Mutable prompt state used to observe category and timestamp cleanup. */
    const promptState = {
      id: PROMPT_ID,
      category: CATEGORY_ID,
      modifiedAt: '2026-01-01T00:00:00.000Z'
    }
    /** Mutable prompt draft state used to observe category and timestamp cleanup. */
    const promptDraftState = { ...promptState }
    /** Mutable template state used to observe category and timestamp cleanup. */
    const templateState = {
      id: TEMPLATE_ID,
      category: CATEGORY_ID,
      modifiedAt: '2026-01-01T00:00:00.000Z'
    }
    /** Mutable template draft state used to observe category and timestamp cleanup. */
    const templateDraftState = { ...templateState }
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
        promptDraft: {
          update: (id: string, update: (draft: typeof promptDraftState) => void) => {
            expect(id).toBe(PROMPT_ID)
            update(promptDraftState)
          }
        },
        promptTemplate: {
          update: (id: string, update: (draft: typeof templateState) => void) => {
            expect(id).toBe(TEMPLATE_ID)
            update(templateState)
          }
        },
        promptTemplateDraft: {
          update: (id: string, update: (draft: typeof templateDraftState) => void) => {
            expect(id).toBe(TEMPLATE_ID)
            update(templateDraftState)
          }
        }
      }
    })

    expect(folderState.categoryIds).toEqual([])
    expect(deleteCategoryOptimistically).toHaveBeenCalledWith(CATEGORY_ID)
    expect(promptState).not.toHaveProperty('category')
    expect(promptDraftState).not.toHaveProperty('category')
    expect(templateState).not.toHaveProperty('category')
    expect(templateDraftState).not.toHaveProperty('category')
    expect(promptState.modifiedAt).not.toBe('2026-01-01T00:00:00.000Z')
    expect(promptDraftState.modifiedAt).toBe(promptState.modifiedAt)
    expect(templateState.modifiedAt).toBe(promptState.modifiedAt)
    expect(templateDraftState.modifiedAt).toBe(promptState.modifiedAt)

    /** Typed entity builders expose expected revisions in the IPC request. */
    const entities = {
      promptFolder: ({ id, data }: { id: string; data: object }) => ({
        id,
        expectedRevision: 3,
        data
      }),
      category: ({ id, data }: { id: string; data: object }) => ({
        id,
        expectedRevision: 2,
        data
      })
    }
    /** IPC invocation spy returns a persistence failure before reconciliation. */
    const invoke = vi.fn().mockResolvedValue({ success: false, error: 'stop before commit' })
    await options.persistMutations({ entities, invoke, transaction: {} })
    expect(invoke).toHaveBeenCalledWith('delete-category', {
      payload: {
        promptFolder: expect.objectContaining({ id: ROOT_FOLDER_ID, expectedRevision: 3 }),
        category: expect.objectContaining({ id: CATEGORY_ID, expectedRevision: 2 })
      }
    })
  })

  it('accepts drafts and reconciles authoritative records after successful deletion', async () => {
    /** Prompt draft acceptance spy verifies successful local transaction retention. */
    const acceptPromptDrafts = vi
      .spyOn(promptDraftCollection.utils, 'acceptMutations')
      .mockImplementation(() => undefined)
    /** Template draft acceptance spy verifies successful local transaction retention. */
    const acceptPromptTemplateDrafts = vi
      .spyOn(promptTemplateDraftCollection.utils, 'acceptMutations')
      .mockImplementation(() => undefined)
    await deleteCategory(CATEGORY_ID)

    /** Revision mutation options registered by deleteCategory. */
    const options = runRevisionMutation.mock.calls[0]?.[0]
    /** Successful authoritative payload returned by category deletion. */
    const payload = {
      promptFolder: {
        id: ROOT_FOLDER_ID,
        revision: 4,
        data: { ...promptFolderCollection.get(ROOT_FOLDER_ID)!, categoryIds: [] }
      },
      prompts: [
        {
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
        }
      ],
      promptTemplates: [
        {
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
        }
      ]
    }
    /** Successful IPC invocation spy returns the authoritative deletion graph. */
    const invoke = vi.fn().mockResolvedValue({ success: true, payload })
    /** Typed entity builders provide the category ownership request. */
    const entities = {
      promptFolder: ({ id, data }: { id: string; data: object }) => ({
        id,
        expectedRevision: 3,
        data
      }),
      category: ({ id, data }: { id: string; data: object }) => ({
        id,
        expectedRevision: 2,
        data
      })
    }
    /** Stable transaction identity passed to both draft collections. */
    const transaction = {}

    await options.persistMutations({ entities, invoke, transaction })
    expect(acceptPromptDrafts).toHaveBeenCalledWith(transaction)
    expect(acceptPromptTemplateDrafts).toHaveBeenCalledWith(transaction)

    options.handleSuccessOrConflictResponse(payload)
    options.onSuccess()
    expect(categoryCollection.get(CATEGORY_ID)).toBeUndefined()
    expect(promptFolderCollection.get(ROOT_FOLDER_ID)?.categoryIds).toEqual([])
    expect(promptDraftCollection.get(PROMPT_ID)).not.toHaveProperty('category')
    expect(promptTemplateDraftCollection.get(TEMPLATE_ID)).not.toHaveProperty('category')
    expect(promptCollection.get(PROMPT_ID)).toMatchObject({
      loadingState: 'full',
      modifiedAt: '2026-08-16T12:00:00.000Z'
    })
    expect(promptTemplateCollection.get(TEMPLATE_ID)).toMatchObject({
      loadingState: 'full',
      modifiedAt: '2026-08-16T12:00:00.000Z'
    })
    expect(promptDraftCollection.get(PROMPT_ID)?.modifiedAt).toBe(
      '2026-08-16T12:00:00.000Z'
    )
    expect(promptTemplateDraftCollection.get(TEMPLATE_ID)?.modifiedAt).toBe(
      '2026-08-16T12:00:00.000Z'
    )
  })
})
