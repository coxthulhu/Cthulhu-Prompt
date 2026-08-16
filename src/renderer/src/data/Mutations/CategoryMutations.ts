import type {
  Category,
  CategoryRevisionResponsePayload,
  CreateCategoryPayload,
  CreateCategoryResponsePayload,
  RenameCategoryPayload,
  SetCategoryDescriptionPayload
} from '@shared/Category'
import { normalizeCategoryDisplayName } from '@shared/Category'
import { compactGuid } from '@shared/compactGuid'
import { categoryCollection } from '../Collections/CategoryCollection'
import { promptFolderCollection } from '../Collections/PromptFolderCollection'
import { runRevisionMutation } from '../IpcFramework/RevisionCollections'

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
