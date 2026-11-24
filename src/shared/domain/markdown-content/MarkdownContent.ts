import type { Draft } from 'immer'
import type { DomainChange } from '@shared/domain/DomainChanges'
import {
  getCollectionContentKind,
  insertCategoryOrderEntry,
  removeCategoryOrderEntry,
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

/** Plans collection-layout updates for moving one ordered entry, or none for a no-op move. */
export const planCategoryOrderedEntryMove = ({
  source,
  sourceStatusFolderId,
  destination,
  destinationStatusFolderId,
  entry,
  content,
  categoryId,
  previousEntryId,
  finalizedIdsKey
}: {
  source: PromptCollection
  sourceStatusFolderId: PromptStatusFolderId
  destination: PromptCollection
  destinationStatusFolderId: PromptStatusFolderId
  entry: CategoryOrderEntryRef
  /** Content whose category metadata follows a manual placement. */
  content: { category?: string }
  categoryId: string | null
  previousEntryId: string | null
  /** Automatically ordered final layouts keep prompts and notes in separate ID lists. */
  finalizedIdsKey: 'promptIds' | 'noteIds'
}): DomainChange[] => {
  /** Destination layout used for exact placement validation. */
  const destinationLayout = destination.statusFolders[destinationStatusFolderId]
  if (destinationLayout.ordering === 'finalizedAt' && previousEntryId !== null) {
    throw new Error('Finalized ordering is automatic')
  }
  /** Validated destination placement; final statuses keep their restoration category. */
  const placement = destinationLayout.ordering === 'category'
    ? placeMarkdownContentInCategoryOrder(destinationLayout.categoryOrder, content, entry, categoryId, previousEntryId)
    : null
  /** Source layout used to resolve the current ordered category. */
  const sourceLayout = source.statusFolders[sourceStatusFolderId]
  /** Current ordered category, absent for automatically sorted final statuses. */
  const sourceCategory = sourceLayout.ordering === 'category'
    ? sourceLayout.categoryOrder.categories.find((group) => group.entries.some((candidate) => candidate.id === entry.id))
    : undefined
  /** Current predecessor within the source category. */
  const sourcePreviousEntryId =
    sourceCategory?.entries[sourceCategory.entries.findIndex((candidate) => candidate.id === entry.id) - 1]?.id ?? null
  /** Whether the physical owning collection or status folder changes. */
  const transfersOwnership = source.id !== destination.id || sourceStatusFolderId !== destinationStatusFolderId
  if (
    !transfersOwnership &&
    (destinationLayout.ordering !== 'category' ||
      (sourceCategory?.categoryId === categoryId && sourcePreviousEntryId === previousEntryId))
  ) {
    return []
  }
  // One update per affected collection, even for moves between layouts in the same collection.
  return Array.from(new Set([source.id, destination.id])).map((id) => ({
    type: 'update' as const,
    entityType: 'promptCollection' as const,
    id,
    recipe: (draft: Draft<PromptCollection>) => {
      if (id === source.id) {
        /** Source layout losing the old ordered or finalized reference. */
        const layout = draft.statusFolders[sourceStatusFolderId]
        if (layout.ordering === 'category') layout.categoryOrder = removeCategoryOrderEntry(layout.categoryOrder, entry)
        else layout[finalizedIdsKey] = layout[finalizedIdsKey].filter((candidateId) => candidateId !== entry.id)
      }
      if (id === destination.id) {
        /** Destination layout receiving the validated placement exactly once. */
        const layout = draft.statusFolders[destinationStatusFolderId]
        if (layout.ordering === 'category') layout.categoryOrder = placement!.categoryOrder
        else layout[finalizedIdsKey] = [entry.id, ...layout[finalizedIdsKey].filter((candidateId) => candidateId !== entry.id)]
      }
    }
  }))
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

/** Returns one category group's ordered prompt or template IDs; notes are not content rows. */
export const getCategoryContentIds = (
  promptCollection: PromptCollection,
  statusFolderId: PromptStatusFolderId,
  categoryId: string | null
): string[] =>
  getMarkdownContentCategoryOrder(promptCollection, statusFolderId).categories
    .find((group) => group.categoryId === categoryId)
    ?.entries.flatMap((entry) => (entry.kind === getCollectionContentKind(promptCollection.kind) ? [entry.id] : [])) ?? []

/** Returns prompt IDs owned by one exact status folder regardless of ordering behavior. */
export const getPromptStatusFolderContentIds = (
  promptCollection: PromptCollection,
  statusFolderId: PromptStatusFolderId
): string[] => {
  /** Layout selected from the collection's status-folder data. */
  const layout = promptCollection.statusFolders[statusFolderId]
  return layout.ordering === 'category'
    ? layout.categoryOrder.categories.flatMap((category) =>
        category.entries.flatMap((entry) => (entry.kind === getCollectionContentKind(promptCollection.kind) ? [entry.id] : []))
      )
    : [...layout.promptIds]
}

/** Returns every content ID owned by one prompt or template collection. */
export const getMarkdownContentIds = (
  promptCollection: PromptCollection,
  kind: PromptCollectionContentKind = getCollectionContentKind(promptCollection.kind)
): string[] => {
  if (getCollectionContentKind(promptCollection.kind) !== kind) return []
  return Object.values(promptCollection.statusFolders).flatMap((layout) =>
    layout.ordering === 'category'
      ? layout.categoryOrder.categories.flatMap((category) =>
          category.entries.flatMap((entry) => (entry.kind === kind ? [entry.id] : []))
        )
      : layout.promptIds
  )
}
