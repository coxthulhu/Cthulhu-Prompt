import {
  insertCategoryOrderEntry,
  type CategoryOrder,
  type CategoryOrderEntryRef,
  type PromptCollection,
  type PromptCollectionContentKind
} from '@shared/domain/prompt-collection/PromptCollection'
import { PromptStatusFolderId } from '@shared/domain/prompt/Prompt'

export type MarkdownContentPersisted = {
  id: string
  title: string
  fallbackTitle: string
  createdAt: string
  modifiedAt: string
  category?: string
}

/** Places content in one category-order position and synchronizes its category metadata. */
export const placeMarkdownContentInCategoryOrder = <TContent extends { category?: string }>(
  categoryOrder: CategoryOrder,
  content: TContent,
  entry: CategoryOrderEntryRef,
  categoryId: string | null,
  previousEntryId: string | null
): { categoryOrder: CategoryOrder; content: TContent } => {
  if (!categoryOrder.categories.some((category) => category.categoryId === categoryId)) {
    throw new Error('Category not loaded')
  }
  /** Content copy whose category metadata matches its ordered group. */
  const placedContent = { ...content }
  if (categoryId === null) delete placedContent.category
  else placedContent.category = categoryId

  return {
    categoryOrder: insertCategoryOrderEntry(
      categoryOrder,
      entry,
      categoryId,
      previousEntryId
    ),
    content: placedContent
  }
}

export const MARKDOWN_CONTENT_KINDS = ['prompt', 'template'] as const

/** Returns the category order owned by one ordered prompt or template collection. */
export const getMarkdownContentCategoryOrder = (
  promptCollection: PromptCollection,
  statusFolderId: PromptStatusFolderId = PromptStatusFolderId.Active
): CategoryOrder => {
  /** Prompt status-folder layout selected by stable registry identity. */
  const layout = promptCollection.statusFolders[statusFolderId]
  if (layout.ordering !== 'category') throw new Error('Prompt status folder is unordered')
  return layout.categoryOrder
}

/** Returns manually ordered content IDs from one prompt status folder or template collection. */
export const getOrderedMarkdownContentIds = (
  promptCollection: PromptCollection,
  kind: PromptCollectionContentKind,
  statusFolderId: PromptStatusFolderId = PromptStatusFolderId.Active
): string[] =>
  getMarkdownContentCategoryOrder(promptCollection, statusFolderId).categories.flatMap((category) =>
    category.entries.flatMap((entry) => (entry.kind === kind ? [entry.id] : []))
  )

/** Returns prompt IDs owned by one exact status folder regardless of ordering behavior. */
export const getPromptStatusFolderContentIds = (
  promptCollection: PromptCollection,
  statusFolderId: PromptStatusFolderId
): string[] => {
  /** Layout selected from the collection's status-folder data. */
  const layout = promptCollection.statusFolders[statusFolderId]
  return layout.ordering === 'category'
    ? layout.categoryOrder.categories.flatMap((category) =>
        category.entries.flatMap((entry) => (entry.kind === promptCollection.kind ? [entry.id] : []))
      )
    : [...layout.promptIds]
}

/** Returns every content ID owned by one prompt or template collection. */
export const getMarkdownContentIds = (
  promptCollection: PromptCollection,
  kind: PromptCollectionContentKind
): string[] => {
  if (promptCollection.kind !== kind) return []
  return Object.values(promptCollection.statusFolders).flatMap((layout) =>
    layout.ordering === 'category'
      ? layout.categoryOrder.categories.flatMap((category) =>
          category.entries.flatMap((entry) => (entry.kind === kind ? [entry.id] : []))
        )
      : layout.promptIds
  )
}
