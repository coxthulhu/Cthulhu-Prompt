import { compactGuid } from '@shared/utilities/compactGuid'
import {
  planCreateCategoryDomainMutation,
  planDeleteCategoryDomainMutation,
  planMoveCategoryDomainMutation,
  planSaveCategoriesDomainMutation,
  planSetCategoryDescriptionDomainMutation,
  planUpdateCategoryDetailsDomainMutation,
  type SaveCategoriesDomainValue
} from '@shared/domain/category/CategoryDomainMutations'
import { getCurrentIsoSecondTimestamp } from '@shared/utilities/isoTimestamp'
import { getPromptCollectionCategoryIds } from '@shared/domain/prompt-collection/PromptCollection'
import { PromptStatusFolderId } from '@shared/domain/prompt/Prompt'
import { categoryCollection } from '@renderer/data/Collections/CategoryCollection'
import { promptCollectionsCollection } from '@renderer/data/Collections/PromptCollectionsCollection'
import { workspaceCollection } from '@renderer/data/Collections/WorkspaceCollection'
import { getAllWorkspaceCollectionEntries } from '@shared/domain/workspace/Workspace'
import {
  mutatePacedRendererDomainMutation,
  runImmediateRendererDomainMutation
} from '@renderer/data/IpcFramework/RendererDomainMutation'

/** Atomically persists every retained category draft for one collection. */
export const saveCategories = async (
  workspaceId: string,
  promptCollectionId: string,
  categories: SaveCategoriesDomainValue[]
): Promise<void> => {
  /** Shared complete-set command projected optimistically and persisted atomically. */
  const command = {
    workspaceId,
    promptCollectionId,
    categories,
    modifiedAt: getCurrentIsoSecondTimestamp()
  }
  await runImmediateRendererDomainMutation({
    mutation: { command, plan: planSaveCategoriesDomainMutation },
    ipc: { channel: 'save-categories' },
    renderer: {}
  })
}

/** Queues a debounced category-description update using the latest optimistic value. */
export const setCategoryDescriptionWithAutosave = (
  categoryId: string,
  description: string | null,
  debounceMs: number
): void => {
  mutatePacedRendererDomainMutation({
    mutation: {
      command: { categoryId, description },
      plan: planSetCategoryDescriptionDomainMutation
    },
    ipc: { channel: 'set-category-description' },
    renderer: {},
    pacing: {
      target: { entityType: 'category', id: categoryId },
      debounceMs
    }
  })
}

/** Creates a collection-owned category and returns its stable client-generated ID. */
export const createCategory = async (
  promptCollectionId: string,
  displayName: string,
  shortDescription: string | null = null,
  description: string | null = null
): Promise<string> => {
  const promptCollection = promptCollectionsCollection.get(promptCollectionId)
  if (!promptCollection) throw new Error('prompt collection not loaded')
  /** Stable client-generated identity used by renderer and main insertion projections. */
  const categoryId = compactGuid(crypto.randomUUID())
  /** Shared command projected optimistically and persisted through domain transitions. */
  const command = {
    categoryId,
    promptCollectionId,
    displayName,
    shortDescription,
    description
  }

  await runImmediateRendererDomainMutation({
    mutation: { command, plan: planCreateCategoryDomainMutation },
    ipc: { channel: 'create-category' },
    renderer: {}
  })

  return categoryId
}

/** Updates a category's title metadata and prompt-style JSON filename. */
export const updateCategoryDetails = async (
  categoryId: string,
  displayName: string,
  shortDescription: string | null
): Promise<void> => {
  const category = categoryCollection.get(categoryId)
  if (!category) throw new Error('Category not loaded')

  /** Shared category-details command projected in both processes. */
  const command = { categoryId, displayName, shortDescription }
  await runImmediateRendererDomainMutation({
    mutation: { command, plan: planUpdateCategoryDetailsDomainMutation },
    ipc: { channel: 'update-category-details' },
    renderer: {}
  })
}

/** Reorders one category group within its owning collection. */
export const moveCategory = async (
  promptCollectionId: string,
  categoryId: string,
  previousCategoryId: string | null,
  statusFolderId: PromptStatusFolderId = PromptStatusFolderId.Active
): Promise<void> => {
  /** Collection whose category order changes. */
  const promptCollection = promptCollectionsCollection.get(promptCollectionId)
  if (!promptCollection) throw new Error('prompt collection not loaded')

  /** Ordered status-folder identity, omitted only for status-free template collections. */
  const resolvedStatusFolderId = promptCollection.kind === 'prompt' ? statusFolderId : null
  /** Shared category movement command scoped to one independent category order. */
  const command = {
    promptCollectionId,
    statusFolderId: resolvedStatusFolderId,
    categoryId,
    previousCategoryId
  }
  await runImmediateRendererDomainMutation({
    mutation: { command, plan: planMoveCategoryDomainMutation },
    ipc: { channel: 'move-category' },
    renderer: {}
  })
}

/** Deletes a category and clears every matching prompt and template reference. */
export const deleteCategory = async (categoryId: string): Promise<void> => {
  /** collection that currently owns the category. */
  const promptCollection = promptCollectionsCollection.toArray.find((collection) =>
    getPromptCollectionCategoryIds(collection).includes(categoryId)
  )
  if (!promptCollection) throw new Error('Category prompt collection not loaded')
  /** Workspace that directly owns the category collection. */
  const workspace = workspaceCollection.toArray.find((candidate) =>
    getAllWorkspaceCollectionEntries(candidate).some((entry) => entry.id === promptCollection.id)
  )
  if (!workspace) throw new Error('Category workspace not loaded')
  /** Renderer-authored command shared with the main-process planner. */
  const command = {
    categoryId,
    promptCollectionId: promptCollection.id,
    workspaceId: workspace.id,
    modifiedAt: getCurrentIsoSecondTimestamp()
  }

  await runImmediateRendererDomainMutation({
    mutation: {
      command,
      plan: planDeleteCategoryDomainMutation
    },
    ipc: { channel: 'delete-category' },
    renderer: {}
  })
}
