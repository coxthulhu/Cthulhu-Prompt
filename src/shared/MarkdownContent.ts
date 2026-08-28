import {
  insertCategoryOrderEntry,
  type CategoryOrder,
  type CategoryOrderEntryRef,
  type PromptFolder,
  type PromptFolderContentKind
} from './PromptFolder'
import type {
  RevisionEnvelope,
  RevisionPayloadEntity,
  RevisionPayloadReference
} from './Revision'

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

export type MarkdownContentRevisionPayload<TContent extends MarkdownContentPersisted> = {
  content: RevisionPayloadEntity<TContent>
}

export type MarkdownContentRevisionResponsePayload<TContent extends MarkdownContentPersisted> = {
  content: RevisionEnvelope<TContent>
  promptFolders: Array<RevisionEnvelope<PromptFolder>>
}

export type CreateMarkdownContentPayload<TContent extends MarkdownContentPersisted> = {
  promptFolder: RevisionPayloadEntity<PromptFolder>
  content: RevisionPayloadEntity<TContent>
  categoryId: string | null
  previousEntryId: string | null
}

export type CreateMarkdownContentResponsePayload<TContent extends MarkdownContentPersisted> = {
  promptFolders: Array<RevisionEnvelope<PromptFolder>>
  content?: RevisionEnvelope<TContent>
}

export type DeleteMarkdownContentPayload<TContent extends MarkdownContentPersisted> = {
  promptFolder: RevisionPayloadEntity<PromptFolder>
  content: RevisionPayloadEntity<TContent>
}

export type DeleteMarkdownContentResponsePayload<
  TContent extends MarkdownContentPersisted
> = {
  promptFolders: Array<RevisionEnvelope<PromptFolder>>
  content?: RevisionEnvelope<TContent>
}

export type MoveMarkdownContentPayload = {
  sourcePromptFolder: RevisionPayloadEntity<PromptFolder>
  destinationPromptFolder: RevisionPayloadEntity<PromptFolder>
  content: RevisionPayloadReference
  categoryId: string | null
  previousEntryId: string | null
}

export type MoveMarkdownContentResponsePayload<TContent extends MarkdownContentPersisted> = {
  promptFolders: Array<RevisionEnvelope<PromptFolder>>
  content: RevisionEnvelope<TContent>
}
