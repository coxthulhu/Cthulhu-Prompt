import type {
  Category,
  CategoryRevisionResponsePayload,
  CreateCategoryPayload,
  CreateCategoryResponsePayload,
  MoveCategoryPayload,
  RenameCategoryPayload,
  SetCategoryDescriptionPayload
} from '@shared/Category'
import { normalizeCategoryDisplayName } from '@shared/Category'
import { compactGuid } from '@shared/compactGuid'
import { planDeleteCategoryDomainMutation } from '@shared/CategoryDomainMutations'
import { getCurrentIsoSecondTimestamp } from '@shared/isoTimestamp'
import type { IpcMutationPayloadResult } from '@shared/IpcResult'
import type { Transaction } from '@tanstack/svelte-db'
import {
  getCategoryOrderCategoryIds,
  insertCategoryOrderGroup,
  moveCategoryOrderGroup,
  type PromptFolderRevisionResponsePayload
} from '@shared/PromptFolder'
import { categoryCollection } from '../Collections/CategoryCollection'
import { promptFolderCollection } from '../Collections/PromptFolderCollection'
import {
  mutatePacedRevisionUpdateTransaction,
  runRevisionMutation
} from '../IpcFramework/RevisionCollections'
import { getLatestMutationModifiedRecord } from '../IpcFramework/RevisionMutationLookup'
import { ipcInvokeWithPayload } from '../IpcFramework/IpcRequestInvoke'
import { runImmediateRendererDomainMutation } from '../IpcFramework/RendererDomainMutation'

/** Reads the latest optimistic category value captured by a paced transaction. */
const readLatestCategoryFromTransaction = (
  transaction: Transaction<any>,
  categoryId: string
): Category =>
  getLatestMutationModifiedRecord(transaction, categoryCollection.id, categoryId, () =>
    categoryCollection.get(categoryId)!
  )

/** Queues a debounced category-description update using the latest optimistic value. */
export const setCategoryDescriptionWithAutosave = (
  categoryId: string,
  description: string | null,
  debounceMs: number
): void => {
  mutatePacedRevisionUpdateTransaction<CategoryRevisionResponsePayload>({
    collectionId: categoryCollection.id,
    elementId: categoryId,
    debounceMs,
    mutateOptimistically: ({ collections }) => {
      collections.category.update(categoryId, (draft) => {
        draft.description = description
      })
    },
    persistMutations: async ({ transaction }) => {
      /** Latest category containing all edits merged into this autosave transaction. */
      const latestCategory = readLatestCategoryFromTransaction(transaction, categoryId)
      return await ipcInvokeWithPayload<
        IpcMutationPayloadResult<CategoryRevisionResponsePayload>,
        SetCategoryDescriptionPayload
      >('set-category-description', {
        category: {
          id: categoryId,
          expectedRevision: categoryCollection.utils.getAuthoritativeRevision(categoryId),
          data: latestCategory
        },
        description: latestCategory.description
      })
    },
    handleSuccessOrConflictResponse: (payload) => {
      categoryCollection.utils.upsertAuthoritative(payload.category)
    },
    conflictMessage: 'Category description update conflict'
  })
}

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
        draft.categoryOrder = insertCategoryOrderGroup(draft.categoryOrder, categoryId)
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

/** Reorders one category group within its owning root folder. */
export const moveCategory = async (
  promptFolderId: string,
  categoryId: string,
  previousCategoryId: string | null
): Promise<void> => {
  /** Root folder whose FolderOrderV2 category sequence changes. */
  const promptFolder = promptFolderCollection.get(promptFolderId)
  if (!promptFolder) throw new Error('Root prompt folder not loaded')

  await runRevisionMutation<PromptFolderRevisionResponsePayload>({
    mutateOptimistically: ({ collections }) => {
      collections.promptFolder.update(promptFolderId, (draft) => {
        draft.categoryOrder = moveCategoryOrderGroup(
          draft.categoryOrder,
          categoryId,
          previousCategoryId
        )
      })
    },
    persistMutations: async ({ entities, invoke }) =>
      await invoke<{ payload: MoveCategoryPayload }>('move-category', {
        payload: {
          promptFolder: entities.promptFolder({ id: promptFolderId, data: promptFolder }),
          categoryId,
          previousCategoryId
        }
      }),
    handleSuccessOrConflictResponse: (payload) => {
      promptFolderCollection.utils.upsertAuthoritative(payload.promptFolder)
    },
    conflictMessage: 'Category move conflict'
  })
}

/** Deletes a category and clears every matching prompt and template reference. */
export const deleteCategory = async (categoryId: string): Promise<void> => {
  /** Root folder that currently owns the category. */
  const promptFolder = promptFolderCollection.toArray.find((folder) =>
    getCategoryOrderCategoryIds(folder.categoryOrder).includes(categoryId)
  )
  if (!promptFolder) throw new Error('Category root prompt folder not loaded')
  /** Renderer-authored command shared with the main-process planner. */
  const command = {
    categoryId,
    promptFolderId: promptFolder.id,
    modifiedAt: getCurrentIsoSecondTimestamp()
  }

  await runImmediateRendererDomainMutation({
    mutation: { command, plan: planDeleteCategoryDomainMutation },
    ipc: { channel: 'delete-category' },
    renderer: {}
  })
}
