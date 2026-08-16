import type {
  Category,
  CategoryRevisionResponsePayload,
  CreateCategoryPayload,
  CreateCategoryResponsePayload,
  DeleteCategoryPayload,
  DeleteCategoryResponsePayload,
  RenameCategoryPayload,
  SetCategoryDescriptionPayload
} from '@shared/Category'
import { normalizeCategoryDisplayName } from '@shared/Category'
import { compactGuid } from '@shared/compactGuid'
import { getCurrentIsoSecondTimestamp } from '@shared/isoTimestamp'
import { createPromptFull } from '@shared/Prompt'
import { createPromptTemplateFull } from '@shared/PromptTemplate'
import { categoryCollection } from '../Collections/CategoryCollection'
import { promptCollection } from '../Collections/PromptCollection'
import { promptDraftCollection } from '../Collections/PromptDraftCollection'
import { promptFolderCollection } from '../Collections/PromptFolderCollection'
import { promptTemplateCollection } from '../Collections/PromptTemplateCollection'
import { promptTemplateDraftCollection } from '../Collections/PromptTemplateDraftCollection'
import { runRevisionMutation } from '../IpcFramework/RevisionCollections'
import { upsertPromptDraft } from '../UiState/PromptDraftHydration'
import { upsertPromptTemplateDrafts } from '../UiState/PromptTemplateDraftMutations.svelte.ts'

/** Creates a root-owned category and returns its stable client-generated ID. */
export const createCategory = async (
  promptFolderId: string,
  displayName: string
): Promise<string> => {
  const promptFolder = promptFolderCollection.get(promptFolderId)
  if (!promptFolder) throw new Error('Root prompt folder not loaded')
  const normalizedDisplayName = normalizeCategoryDisplayName(displayName)
  const categoryId = compactGuid(crypto.randomUUID())
  const category: Category = { id: categoryId, displayName: normalizedDisplayName, description: null }

  await runRevisionMutation<CreateCategoryResponsePayload>({
    mutateOptimistically: ({ collections }) => {
      collections.category.insert(category)
      collections.promptFolder.update(promptFolderId, (draft) => {
        draft.categoryIds = [...draft.categoryIds, categoryId]
      })
    },
    persistMutations: async ({ entities, invoke }) => {
      return await invoke<{ payload: CreateCategoryPayload }>('create-category', {
        payload: {
          promptFolder: entities.promptFolder({ id: promptFolderId, data: promptFolder }),
          category: entities.category({ id: categoryId, data: category })
        }
      })
    },
    handleSuccessOrConflictResponse: (payload) => {
      promptFolderCollection.utils.upsertAuthoritative(payload.promptFolder)
      if (payload.category) categoryCollection.utils.upsertAuthoritative(payload.category)
    },
    conflictMessage: 'Category create conflict'
  })

  return categoryId
}

/** Renames a category and its prompt-style JSON filename. */
export const renameCategory = async (categoryId: string, displayName: string): Promise<void> => {
  const category = categoryCollection.get(categoryId)
  if (!category) throw new Error('Category not loaded')
  const normalizedDisplayName = normalizeCategoryDisplayName(displayName)

  await runRevisionMutation<CategoryRevisionResponsePayload>({
    mutateOptimistically: ({ collections }) => {
      collections.category.update(categoryId, (draft) => {
        draft.displayName = normalizedDisplayName
      })
    },
    persistMutations: async ({ entities, invoke }) => {
      return await invoke<{ payload: RenameCategoryPayload }>('rename-category', {
        payload: {
          category: entities.category({ id: categoryId, data: category }),
          displayName: normalizedDisplayName
        }
      })
    },
    handleSuccessOrConflictResponse: (payload) => {
      categoryCollection.utils.upsertAuthoritative(payload.category)
    },
    conflictMessage: 'Category rename conflict'
  })
}

/** Sets a category description, preserving empty strings separately from null. */
export const setCategoryDescription = async (
  categoryId: string,
  description: string | null
): Promise<void> => {
  const category = categoryCollection.get(categoryId)
  if (!category) throw new Error('Category not loaded')

  await runRevisionMutation<CategoryRevisionResponsePayload>({
    mutateOptimistically: ({ collections }) => {
      collections.category.update(categoryId, (draft) => {
        draft.description = description
      })
    },
    persistMutations: async ({ entities, invoke }) => {
      return await invoke<{ payload: SetCategoryDescriptionPayload }>(
        'set-category-description',
        {
          payload: {
            category: entities.category({ id: categoryId, data: category }),
            description
          }
        }
      )
    },
    handleSuccessOrConflictResponse: (payload) => {
      categoryCollection.utils.upsertAuthoritative(payload.category)
    },
    conflictMessage: 'Category description update conflict'
  })
}

/** Deletes a category and clears every matching prompt and template reference. */
export const deleteCategory = async (categoryId: string): Promise<void> => {
  /** Authoritative category selected for deletion. */
  const category = categoryCollection.get(categoryId)
  if (!category) throw new Error('Category not loaded')
  /** Root folder that currently owns the category. */
  const promptFolder = promptFolderCollection.toArray.find((folder) =>
    folder.categoryIds.includes(categoryId)
  )
  if (!promptFolder) throw new Error('Category root prompt folder not loaded')
  /** Every renderer prompt carrying the deleted category ID. */
  const promptIds = promptCollection.toArray
    .filter((prompt) => prompt.category === categoryId)
    .map((prompt) => prompt.id)
  /** Every renderer template carrying the deleted category ID. */
  const promptTemplateIds = promptTemplateCollection.toArray
    .filter((promptTemplate) => promptTemplate.category === categoryId)
    .map((promptTemplate) => promptTemplate.id)
  /** One logical timestamp for the optimistic reference cleanup. */
  const modifiedAt = getCurrentIsoSecondTimestamp()

  await runRevisionMutation<DeleteCategoryResponsePayload>({
    mutateOptimistically: ({ collections }) => {
      collections.promptFolder.update(promptFolder.id, (draft) => {
        draft.categoryIds = draft.categoryIds.filter((id) => id !== categoryId)
      })
      collections.category.delete(categoryId)
      for (const promptId of promptIds) {
        collections.prompt.update(promptId, (draft) => {
          delete draft.category
          draft.modifiedAt = modifiedAt
        })
        collections.promptDraft.update(promptId, (draft) => {
          delete draft.category
          draft.modifiedAt = modifiedAt
        })
      }
      for (const promptTemplateId of promptTemplateIds) {
        collections.promptTemplate.update(promptTemplateId, (draft) => {
          delete draft.category
          draft.modifiedAt = modifiedAt
        })
        collections.promptTemplateDraft.update(promptTemplateId, (draft) => {
          delete draft.category
          draft.modifiedAt = modifiedAt
        })
      }
    },
    persistMutations: async ({ entities, invoke, transaction }) => {
      /** Result of the atomic category deletion request. */
      const result = await invoke<{ payload: DeleteCategoryPayload }>('delete-category', {
        payload: {
          promptFolder: entities.promptFolder({ id: promptFolder.id, data: promptFolder }),
          category: entities.category({ id: categoryId, data: category })
        }
      })
      if (result.success) {
        promptDraftCollection.utils.acceptMutations(transaction)
        promptTemplateDraftCollection.utils.acceptMutations(transaction)
      }
      return result
    },
    handleSuccessOrConflictResponse: (payload) => {
      promptFolderCollection.utils.upsertAuthoritative(payload.promptFolder)
      if (payload.category) categoryCollection.utils.upsertAuthoritative(payload.category)
      for (const prompt of payload.prompts) {
        /** Full authoritative prompt shape used by the renderer and its draft. */
        const fullPrompt = { ...prompt, data: createPromptFull(prompt.data) }
        promptCollection.utils.upsertAuthoritative(fullPrompt)
        upsertPromptDraft(fullPrompt.data)
      }
      for (const promptTemplate of payload.promptTemplates) {
        /** Full authoritative template shape used by the renderer and its draft. */
        const fullPromptTemplate = {
          ...promptTemplate,
          data: createPromptTemplateFull(promptTemplate.data)
        }
        promptTemplateCollection.utils.upsertAuthoritative(fullPromptTemplate)
        upsertPromptTemplateDrafts([fullPromptTemplate.data])
      }
    },
    conflictMessage: 'Category delete conflict',
    onSuccess: () => {
      categoryCollection.utils.deleteAuthoritative(categoryId)
    }
  })
}
