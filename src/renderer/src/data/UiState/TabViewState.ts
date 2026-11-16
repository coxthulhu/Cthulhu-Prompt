import type { CollectionViewState } from '@shared/domain/ui-state/TabSession'
import type { PromptStatusFolderId } from '@shared/domain/prompt/Prompt'

/** Reads a tab's saved status viewport without confusing an unvisited mode with zero. */
export const lookupPromptCollectionScrollTop = (view: CollectionViewState, _collectionId: string, mode: PromptStatusFolderId): number | null => view.scrollTopByMode[mode] ?? null

/** Records the actual reachable viewport in the tab's session snapshot. */
export const setPromptCollectionScrollTopWithAutosave = (view: CollectionViewState, _collectionId: string, mode: PromptStatusFolderId, offset: number): void => { view.scrollTopByMode[mode] = offset }

/** Reads the selected row retained by this tab. */
export const lookupWorkspacePersistedPromptCollectionSelection = (view: CollectionViewState, _collectionId: string) =>
  view.contentOwnerId ? { contentOwnerId: view.contentOwnerId, selectedEntryId: view.selectedEntryId } : null

/** Saves row selection without touching another tab's collection view. */
export const setPromptCollectionSelectedEntryIdWithAutosave = (view: CollectionViewState, _collectionId: string, ownerId: string, entryId: string): void => {
  view.contentOwnerId = ownerId
  view.selectedEntryId = entryId
}

/** Reads one category's expansion choice in this tab. */
export const lookupWorkspacePersistedCategoryTreeExpandedState = (view: CollectionViewState, ownerId: string): boolean | null => view.owners[ownerId]?.treeIsExpanded ?? null

/** Saves category expansion in this tab. */
export const setCategoryTreeExpandedStateWithAutosave = (view: CollectionViewState, ownerId: string, expanded: boolean): void => {
  view.owners[ownerId] ??= { treeIsExpanded: true, contentSectionIsExpanded: true }
  view.owners[ownerId].treeIsExpanded = expanded
}

/** Reads one content section's expansion choice in this tab. */
export const lookupWorkspacePersistedPromptCollectionContentSectionExpandedState = (view: CollectionViewState, ownerId: string): boolean | null => view.owners[ownerId]?.contentSectionIsExpanded ?? null

/** Saves content expansion in this tab. */
export const setPromptCollectionContentSectionExpandedStateWithAutosave = (view: CollectionViewState, ownerId: string, expanded: boolean): void => {
  view.owners[ownerId] ??= { treeIsExpanded: true, contentSectionIsExpanded: true }
  view.owners[ownerId].contentSectionIsExpanded = expanded
}
