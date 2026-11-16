import { isPromptStatusFolderId, PromptStatusFolderId } from '@shared/domain/prompt/Prompt'
import { parseWorkspaceAccordionSections, type WorkspaceAccordionSectionViewEntry } from '@shared/domain/user-persistence/UserPersistence'

/** Expansion choices owned by one tab's collection or category. */
export type TabContentOwnerState = {
  treeIsExpanded: boolean
  contentSectionIsExpanded: boolean
}

/** Complete collection location copied when a collection opens and retained independently thereafter. */
export type CollectionViewState = {
  selectedMode: PromptStatusFolderId
  shownFinalStatusGroups: Partial<Record<PromptStatusFolderId, boolean>>
  modeHistory: PromptStatusFolderId[]
  contentOwnerId: string | null
  selectedEntryId: string
  owners: Record<string, TabContentOwnerState>
  scrollTopByMode: Partial<Record<PromptStatusFolderId, number>>
  treeScrollTopByMode: Partial<Record<PromptStatusFolderId, number>>
  accordionSections: WorkspaceAccordionSectionViewEntry[]
  editorViewStates: Record<string, string>
}

/** One workspace tab, including its retained New Tab and collection locations. */
export type WorkspaceTab = {
  id: string
  collectionId: string | null
  openPromptId: string | null
  lastAccessed: number
  newTab: { search: string; scrollTop: number }
  view: CollectionViewState
  singlePromptEditorViewStates: Record<string, string>
}

/** Empty collection location before any saved state exists. */
export const createCollectionViewState = (): CollectionViewState => ({
  selectedMode: PromptStatusFolderId.Active,
  shownFinalStatusGroups: {},
  modeHistory: [],
  contentOwnerId: null,
  selectedEntryId: 'collection-header',
  owners: {},
  scrollTopByMode: {},
  treeScrollTopByMode: {},
  accordionSections: [],
  editorViewStates: {}
})

/** Creates a fresh tab without inheriting another tab's search or scroll position. */
export const createWorkspaceTab = (id: string): WorkspaceTab => ({
  id, collectionId: null, openPromptId: null, lastAccessed: 0,
  newTab: { search: '', scrollTop: 0 }, view: createCollectionViewState(),
  singlePromptEditorViewStates: {}
})

/** Plain record validation shared by the nested IPC payload checks. */
const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

/** Finite nonnegative viewport or access-order value. */
const isOffset = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0

/** String-valued editor state map. */
const isEditorStates = (value: unknown): value is Record<string, string> =>
  isRecord(value) && Object.values(value).every((entry) => typeof entry === 'string')

/** Strictly validates a collection snapshot at the IPC boundary. */
export const isCollectionViewState = (value: unknown): value is CollectionViewState => {
  if (!isRecord(value) || Object.keys(value).length !== 10) return false
  return isPromptStatusFolderId(value.selectedMode) &&
    isRecord(value.shownFinalStatusGroups) && Object.entries(value.shownFinalStatusGroups).every(([key, shown]) => isPromptStatusFolderId(key) && typeof shown === 'boolean') &&
    Array.isArray(value.modeHistory) && value.modeHistory.every(isPromptStatusFolderId) &&
    (value.contentOwnerId === null || typeof value.contentOwnerId === 'string') &&
    typeof value.selectedEntryId === 'string' &&
    isRecord(value.owners) && Object.values(value.owners).every((owner) => isRecord(owner) && Object.keys(owner).length === 2 && typeof owner.treeIsExpanded === 'boolean' && typeof owner.contentSectionIsExpanded === 'boolean') &&
    [value.scrollTopByMode, value.treeScrollTopByMode].every((offsets) => isRecord(offsets) && Object.entries(offsets).every(([mode, offset]) => isPromptStatusFolderId(mode) && isOffset(offset))) &&
    parseWorkspaceAccordionSections(value.accordionSections) !== null && isEditorStates(value.editorViewStates)
}

/** Strictly validates one persisted tab supplied through IPC. */
export const isWorkspaceTab = (value: unknown): value is WorkspaceTab =>
  isRecord(value) && Object.keys(value).length === 7 && typeof value.id === 'string' &&
  (value.collectionId === null || typeof value.collectionId === 'string') &&
  (value.openPromptId === null || typeof value.openPromptId === 'string') &&
  isOffset(value.lastAccessed) && isRecord(value.newTab) && Object.keys(value.newTab).length === 2 &&
  typeof value.newTab.search === 'string' && isOffset(value.newTab.scrollTop) &&
  isCollectionViewState(value.view) && isEditorStates(value.singlePromptEditorViewStates)

/** Removes a deleted collection from every tab and its remembered closed location. */
export const removeCollectionFromTabSession = (state: { tabs: WorkspaceTab[]; lastClosedCollections: Record<string, CollectionViewState> }, collectionId: string): void => {
  delete state.lastClosedCollections[collectionId]
  for (const tab of state.tabs) {
    if (tab.collectionId !== collectionId) continue
    tab.collectionId = null
    tab.openPromptId = null
    tab.view = createCollectionViewState()
    tab.singlePromptEditorViewStates = {}
  }
}

/** Transfers deleted category selections to the collection while preserving selected content. */
export const removeCategoriesFromTabSession = (state: { tabs: WorkspaceTab[]; lastClosedCollections: Record<string, CollectionViewState> }, collectionId: string, categoryIds: string[]): void => {
  /** Open views and the closed snapshot are independently owned. */
  const views = [...state.tabs.filter((tab) => tab.collectionId === collectionId).map((tab) => tab.view)]
  if (state.lastClosedCollections[collectionId]) views.push(state.lastClosedCollections[collectionId])
  for (const view of views) {
    for (const id of categoryIds) delete view.owners[id]
    if (view.contentOwnerId && categoryIds.includes(view.contentOwnerId)) {
      view.contentOwnerId = collectionId
      if (view.selectedEntryId === 'category-details') view.selectedEntryId = 'collection-header'
    }
  }
}

/** Repairs all retained views after content disappears or moves outside this collection. */
export const pruneCollectionTabViews = (
  state: { tabs: WorkspaceTab[]; lastClosedCollections: Record<string, CollectionViewState> },
  collectionId: string,
  categoryIds: string[],
  contentIds: string[],
  noteIds: string[]
): void => {
  /** Every independently owned collection snapshot, including a single prompt's return location. */
  const views = [...state.tabs.filter((tab) => tab.collectionId === collectionId).map((tab) => tab.view)]
  if (state.lastClosedCollections[collectionId]) views.push(state.lastClosedCollections[collectionId])
  for (const view of views) {
    for (const id of Object.keys(view.editorViewStates)) if (!contentIds.includes(id) && !noteIds.includes(id)) delete view.editorViewStates[id]
    for (const id of Object.keys(view.owners)) if (id !== collectionId && !categoryIds.includes(id)) delete view.owners[id]
    if (view.contentOwnerId && view.contentOwnerId !== collectionId && !categoryIds.includes(view.contentOwnerId)) {
      view.contentOwnerId = collectionId
      if (view.selectedEntryId === 'category-details') view.selectedEntryId = 'collection-header'
    }
    if (!['collection-header', 'category-details'].includes(view.selectedEntryId) && !contentIds.includes(view.selectedEntryId)) view.selectedEntryId = 'collection-header'
  }
  for (const tab of state.tabs) {
    if (tab.collectionId !== collectionId) continue
    for (const id of Object.keys(tab.singlePromptEditorViewStates)) if (!contentIds.includes(id) && !noteIds.includes(id)) delete tab.singlePromptEditorViewStates[id]
    if (tab.collectionId === collectionId && tab.openPromptId && !contentIds.includes(tab.openPromptId)) tab.openPromptId = null
  }
}

/** Deletes editor locations and selection references atomically with their prompt or template. */
export const removeContentFromTabSession = (
  state: { tabs: WorkspaceTab[]; lastClosedCollections: Record<string, CollectionViewState> },
  collectionId: string,
  contentId: string,
  attachedNoteId?: string | null
): void => {
  /** Both the content and its attached note disappear in the same domain mutation. */
  const removedIds = [contentId, ...(attachedNoteId ? [attachedNoteId] : [])]
  /** Retained collection views remain independent while sharing the same content identities. */
  const views = [...state.tabs.filter((tab) => tab.collectionId === collectionId).map((tab) => tab.view)]
  if (state.lastClosedCollections[collectionId]) views.push(state.lastClosedCollections[collectionId])
  for (const view of views) {
    for (const id of removedIds) delete view.editorViewStates[id]
    if (view.selectedEntryId === contentId) view.selectedEntryId = 'collection-header'
  }
  for (const tab of state.tabs) {
    if (tab.collectionId !== collectionId) continue
    for (const id of removedIds) delete tab.singlePromptEditorViewStates[id]
    if (tab.openPromptId === contentId) tab.openPromptId = null
  }
}
