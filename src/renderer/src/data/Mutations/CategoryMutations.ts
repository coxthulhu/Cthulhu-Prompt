import type {
  Category,
  CategoryRevisionResponsePayload,
  SetCategoryDescriptionPayload
} from '@shared/Category'
import { compactGuid } from '@shared/compactGuid'
import {
  planCreateCategoryDomainMutation,
  planDeleteCategoryDomainMutation,
  planMoveCategoryDomainMutation,
  planRenameCategoryDomainMutation
} from '@shared/CategoryDomainMutations'
import { getCurrentIsoSecondTimestamp } from '@shared/isoTimestamp'
import type { IpcMutationPayloadResult } from '@shared/IpcResult'
import type { Transaction } from '@tanstack/svelte-db'
import { getCategoryOrderCategoryIds } from '@shared/PromptFolder'
import { categoryCollection } from '../Collections/CategoryCollection'
import { promptFolderCollection } from '../Collections/PromptFolderCollection'
import { mutatePacedRevisionUpdateTransaction } from '../IpcFramework/RevisionCollections'
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
  /** Stable client-generated identity used by renderer and main insertion projections. */
  const categoryId = compactGuid(crypto.randomUUID())
  /** Shared command projected optimistically and persisted through domain transitions. */
  const command = { categoryId, promptFolderId, displayName }

  await runImmediateRendererDomainMutation({
    mutation: { command, plan: planCreateCategoryDomainMutation },
    ipc: { channel: 'create-category' },
    renderer: {}
  })

  return categoryId
}

/** Renames a category and its prompt-style JSON filename. */
export const renameCategory = async (categoryId: string, displayName: string): Promise<void> => {
  const category = categoryCollection.get(categoryId)
  if (!category) throw new Error('Category not loaded')

  /** Shared category rename command projected in both processes. */
  const command = { categoryId, displayName }
  await runImmediateRendererDomainMutation({
    mutation: { command, plan: planRenameCategoryDomainMutation },
    ipc: { channel: 'rename-category' },
    renderer: {}
  })
}

/** Reorders one category group within its owning root folder. */
export const moveCategory = async (
  promptFolderId: string,
  categoryId: string,
  previousCategoryId: string | null
): Promise<void> => {
  /** Root folder whose FolderOrder category sequence changes. */
  const promptFolder = promptFolderCollection.get(promptFolderId)
  if (!promptFolder) throw new Error('Root prompt folder not loaded')

  /** Shared category reorder command projected in both processes. */
  const command = { promptFolderId, categoryId, previousCategoryId }
  await runImmediateRendererDomainMutation({
    mutation: { command, plan: planMoveCategoryDomainMutation },
    ipc: { channel: 'move-category' },
    renderer: {}
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
