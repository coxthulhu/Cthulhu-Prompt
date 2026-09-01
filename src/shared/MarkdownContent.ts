import {
  insertCategoryOrderEntry,
  type CategoryOrder,
  type CategoryOrderEntryRef,
  type PromptFolder,
  type PromptFolderContentKind
} from './PromptFolder'

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

export const getActiveMarkdownContentIds = (
  promptFolder: PromptFolder,
  kind: PromptFolderContentKind
): string[] =>
  promptFolder.categoryOrder.categories.flatMap((category) =>
    category.entries.flatMap((entry) => (entry.kind === kind ? [entry.id] : []))
  )

export const getMarkdownContentIds = (
  promptFolder: PromptFolder,
  kind: PromptFolderContentKind
): string[] => [
  ...getActiveMarkdownContentIds(promptFolder, kind),
  ...(kind === 'prompt' ? promptFolder.completedPromptIds : [])
]
