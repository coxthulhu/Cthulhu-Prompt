import {
  insertCategoryOrderEntry,
  type CategoryOrder,
  type CategoryOrderEntryRef,
  type PromptFolder,
  type PromptFolderContentKind
} from './PromptFolder'
import { PromptStatusFolderId } from './Prompt'

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

/** Returns the category order owned by one ordered prompt or template folder. */
export const getMarkdownContentCategoryOrder = (
  promptFolder: PromptFolder,
  statusFolderId: PromptStatusFolderId = PromptStatusFolderId.Active
): CategoryOrder => {
  if (promptFolder.kind === 'template') return promptFolder.categoryOrder
  /** Prompt status-folder layout selected by stable registry identity. */
  const layout = promptFolder.statusFolders[statusFolderId]
  if (layout.ordering !== 'category') throw new Error('Prompt status folder is unordered')
  return layout.categoryOrder
}

/** Returns manually ordered content IDs from one prompt status folder or template root. */
export const getOrderedMarkdownContentIds = (
  promptFolder: PromptFolder,
  kind: PromptFolderContentKind,
  statusFolderId: PromptStatusFolderId = PromptStatusFolderId.Active
): string[] =>
  getMarkdownContentCategoryOrder(promptFolder, statusFolderId).categories.flatMap((category) =>
    category.entries.flatMap((entry) => (entry.kind === kind ? [entry.id] : []))
  )

/** Returns prompt IDs owned by one exact status folder regardless of ordering behavior. */
export const getPromptStatusFolderContentIds = (
  promptFolder: Extract<PromptFolder, { kind: 'prompt' }>,
  statusFolderId: PromptStatusFolderId
): string[] => {
  /** Layout selected from the root's status-folder data. */
  const layout = promptFolder.statusFolders[statusFolderId]
  return layout.ordering === 'category'
    ? layout.categoryOrder.categories.flatMap((category) =>
        category.entries.flatMap((entry) => (entry.kind === 'prompt' ? [entry.id] : []))
      )
    : [...layout.promptIds]
}

/** Returns every content ID owned by one prompt or template root. */
export const getMarkdownContentIds = (
  promptFolder: PromptFolder,
  kind: PromptFolderContentKind
): string[] => {
  if (promptFolder.kind === 'template') {
    return getOrderedMarkdownContentIds(promptFolder, kind)
  }
  return Object.values(promptFolder.statusFolders).flatMap((layout) =>
    layout.ordering === 'category'
      ? layout.categoryOrder.categories.flatMap((category) =>
          category.entries.flatMap((entry) => (entry.kind === kind ? [entry.id] : []))
        )
      : layout.promptIds
  )
}
