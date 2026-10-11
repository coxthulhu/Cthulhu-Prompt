import { AUTOSAVE_MS } from '@renderer/data/UiState/autosave/draftAutosave'
import { PromptStatusFolderId } from '@shared/domain/prompt/Prompt'
import {
  isPromptCollectionScreenSelection,
  type WorkspaceAccordionSectionViewEntry
} from '@shared/domain/user-persistence/UserPersistence'
import {
  createAccordionUiStateKey,
  createWorkspacePromptCollectionUiStateKey,
  type AccordionUiState,
  type WorkspacePromptCollectionUiState
} from '@shared/domain/ui-state/UiState'
import { accordionUiStateCollection } from '@renderer/data/Collections/AccordionUiStateCollection'
import { workspacePromptCollectionUiStateCollection } from '@renderer/data/Collections/WorkspacePromptCollectionUiStateCollection'
import { workspaceUiStateCollection } from '@renderer/data/Collections/WorkspaceUiStateCollection'
import { submitPacedUpdateTransactionAndWait } from '@renderer/data/IpcFramework/RevisionCollections'
import {
  setAccordionUiStateWithAutosave,
  setWorkspacePromptCollectionUiStateWithAutosave,
  setWorkspaceUiStateWithAutosave
} from '@renderer/data/Mutations/WorkspaceUiStateMutations'

/** Default selection stored before a content owner has an explicit row selection. */
const DEFAULT_SELECTED_ENTRY_ID = 'collection-header'
/** Default sidebar expansion for a newly observed content owner. */
const DEFAULT_TREE_IS_EXPANDED = true
/** Default content expansion for a newly observed content owner. */
const DEFAULT_CONTENT_SECTION_IS_EXPANDED = true

/** Creates default prompt-collection view state for one collection or category owner. */
const createPromptCollectionUiState = (
  workspaceId: string,
  contentOwnerId: string
): WorkspacePromptCollectionUiState => ({
  workspaceId,
  contentOwnerId,
  selectedEntryId: DEFAULT_SELECTED_ENTRY_ID,
  treeIsExpanded: DEFAULT_TREE_IS_EXPANDED,
  contentSectionIsExpanded: DEFAULT_CONTENT_SECTION_IS_EXPANDED,
  scrollTopByMode: {},
  selectedMode: PromptStatusFolderId.Active,
  shownFinalStatusGroups: {}
})

/** Reads one collection or category prompt-collection view state by its composite key. */
export const lookupPromptCollectionUiState = (
  workspaceId: string,
  contentOwnerId: string
): WorkspacePromptCollectionUiState | null =>
  workspacePromptCollectionUiStateCollection.get(
    createWorkspacePromptCollectionUiStateKey(workspaceId, contentOwnerId)
  ) ?? null

/** Queues one content owner's changed view fields and optional active-owner pointer. */
const setPromptCollectionUiStateFieldsWithAutosave = (
  workspaceId: string,
  contentOwnerId: string,
  updates: Partial<
    Pick<
      WorkspacePromptCollectionUiState,
      | 'selectedEntryId'
      | 'treeIsExpanded'
      | 'contentSectionIsExpanded'
      | 'scrollTopByMode'
      | 'selectedMode'
      | 'shownFinalStatusGroups'
    >
  >,
  selectedPromptCollectionId?: string
): void => {
  /** Current or default owner state used to build a complete replacement command. */
  const current =
    lookupPromptCollectionUiState(workspaceId, contentOwnerId) ??
    createPromptCollectionUiState(workspaceId, contentOwnerId)
  /** Complete desired owner state after applying the requested fields. */
  const next = { ...current, ...updates }
  /** Whether at least one persisted owner field changed. */
  const hasOwnerChange = Object.entries(updates).some(
    ([key, value]) => current[key as keyof WorkspacePromptCollectionUiState] !== value
  )
  if (hasOwnerChange) {
    setWorkspacePromptCollectionUiStateWithAutosave(next, AUTOSAVE_MS)
  }

  /** Current workspace screen state whose active owner may change separately. */
  const workspaceUiState = workspaceUiStateCollection.get(workspaceId)
  if (
    selectedPromptCollectionId &&
    workspaceUiState &&
    isPromptCollectionScreenSelection(workspaceUiState) &&
    workspaceUiState.selectedScreenData.promptCollectionId === selectedPromptCollectionId &&
    workspaceUiState.selectedScreenData.contentOwnerId !== contentOwnerId
  ) {
    setWorkspaceUiStateWithAutosave(
      {
        ...workspaceUiState,
        selectedScreenData: {
          ...workspaceUiState.selectedScreenData,
          contentOwnerId
        }
      },
      AUTOSAVE_MS
    )
  }
}

/** Saves collection-specific navigation without changing selection, scroll, or accordion sizing. */
export const setPromptCollectionStatusNavigationWithAutosave = (
  workspaceId: string,
  promptCollectionId: string,
  selectedMode: PromptStatusFolderId,
  shownFinalStatusGroups: WorkspacePromptCollectionUiState['shownFinalStatusGroups']
): void => {
  setPromptCollectionUiStateFieldsWithAutosave(workspaceId, promptCollectionId, {
    selectedMode,
    shownFinalStatusGroups: { ...shownFinalStatusGroups }
  })
}

/** Workspace-wide accordion shared by the collections' status trees. */
export const PROMPT_STATUS_ACCORDION_PERSISTENCE_ID = 'sidebar-prompt-statuses'

/** Expands a navigation destination while retaining every configured section height. */
export const expandPromptStatusSectionWithAutosave = (
  workspaceId: string,
  mode: PromptStatusFolderId
): void => {
  /** Saved sections default to expanded until the user explicitly collapses one. */
  const current = lookupWorkspacePersistedAccordionViewEntry(
    workspaceId, PROMPT_STATUS_ACCORDION_PERSISTENCE_ID
  )
  if (!current?.sections.some((section) => section.id === mode && !section.isExpanded)) return
  setAccordionViewEntryWithAutosave(workspaceId, {
    ...current,
    sections: current.sections.map((section) =>
      section.id === mode ? { ...section, isExpanded: true } : section
    )
  })
}

/** Reads the saved offset without treating an unvisited mode as a saved top position. */
export const lookupPromptCollectionScrollTop = (
  workspaceId: string,
  promptCollectionId: string,
  mode: PromptStatusFolderId
): number | null =>
  lookupPromptCollectionUiState(workspaceId, promptCollectionId)?.scrollTopByMode[mode] ?? null

/** Saves one mode's reachable offset while retaining the collection's other UI state. */
export const setPromptCollectionScrollTopWithAutosave = (
  workspaceId: string,
  promptCollectionId: string,
  mode: PromptStatusFolderId,
  scrollTopPx: number
): void => {
  /** Latest optimistic offsets include other mode changes still awaiting autosave. */
  const current = lookupPromptCollectionUiState(workspaceId, promptCollectionId)?.scrollTopByMode ?? {}
  if (current[mode] === scrollTopPx) return
  setPromptCollectionUiStateFieldsWithAutosave(workspaceId, promptCollectionId, {
    scrollTopByMode: { ...current, [mode]: scrollTopPx }
  })
}

/** Looks up the complete saved state for one workspace accordion instance. */
export const lookupWorkspacePersistedAccordionViewEntry = (
  workspaceId: string,
  persistenceId: string
): AccordionUiState | null => {
  /** Saved accordion record selected by its composite authoritative key. */
  const entry = accordionUiStateCollection.get(
    createAccordionUiStateKey(workspaceId, persistenceId)
  )
  return entry ? { ...entry, sections: entry.sections.map((section) => ({ ...section })) } : null
}

/** Persists one complete accordion instance through its split collection. */
export const setAccordionViewEntryWithAutosave = (
  workspaceId: string,
  accordionViewEntry: { persistenceId: string; sections: WorkspaceAccordionSectionViewEntry[] }
): void => {
  /** Complete desired accordion state with independent section objects. */
  const next: AccordionUiState = {
    workspaceId,
    persistenceId: accordionViewEntry.persistenceId,
    sections: accordionViewEntry.sections.map((section) => ({ ...section }))
  }
  /** Current accordion state used to avoid redundant serialized writes. */
  const current = accordionUiStateCollection.get(
    createAccordionUiStateKey(workspaceId, accordionViewEntry.persistenceId)
  )
  if (current && JSON.stringify(current.sections) === JSON.stringify(next.sections)) return
  setAccordionUiStateWithAutosave(next, AUTOSAVE_MS)
}

/** Persisted row selection and its collection or category owner. */
export type WorkspacePersistedPromptCollectionSelection = {
  contentOwnerId: string
  selectedEntryId: string
}

/** Looks up the selected prompt-collection screen row and its persisted content owner. */
export const lookupWorkspacePersistedPromptCollectionSelection = (
  workspaceId: string,
  promptCollectionId: string
): WorkspacePersistedPromptCollectionSelection | null => {
  /** Workspace screen state containing the active content-owner pointer. */
  const workspaceUiState = workspaceUiStateCollection.get(workspaceId)
  if (
    !workspaceUiState ||
    !isPromptCollectionScreenSelection(workspaceUiState) ||
    workspaceUiState.selectedScreenData.promptCollectionId !== promptCollectionId
  ) {
    return null
  }
  /** Active content owner whose saved row selection should be restored. */
  const contentOwnerId = workspaceUiState.selectedScreenData.contentOwnerId
  if (!contentOwnerId) return null
  /** Per-owner state containing the saved row selection. */
  const entry = lookupPromptCollectionUiState(workspaceId, contentOwnerId)
  return entry ? { contentOwnerId, selectedEntryId: entry.selectedEntryId } : null
}

/** Looks up whether one category is expanded in the sidebar tree. */
export const lookupWorkspacePersistedCategoryTreeExpandedState = (
  workspaceId: string,
  categoryId: string
): boolean | null => lookupPromptCollectionUiState(workspaceId, categoryId)?.treeIsExpanded ?? null

/** Looks up whether one content owner's content section is expanded. */
export const lookupWorkspacePersistedPromptCollectionContentSectionExpandedState = (
  workspaceId: string,
  contentOwnerId: string
): boolean | null =>
  lookupPromptCollectionUiState(workspaceId, contentOwnerId)?.contentSectionIsExpanded ?? null

/** Persists the selected row and active owner for one prompt-collection screen. */
export const setPromptCollectionSelectedEntryIdWithAutosave = (
  workspaceId: string,
  promptCollectionId: string,
  contentOwnerId: string,
  selectedEntryId: string
): void => {
  setPromptCollectionUiStateFieldsWithAutosave(
    workspaceId,
    contentOwnerId,
    { selectedEntryId },
    promptCollectionId
  )
}

/** Persists whether one category is expanded in the sidebar tree. */
export const setCategoryTreeExpandedStateWithAutosave = (
  workspaceId: string,
  categoryId: string,
  treeIsExpanded: boolean
): void => {
  setPromptCollectionUiStateFieldsWithAutosave(workspaceId, categoryId, { treeIsExpanded })
}

/** Persists whether one content owner's content section is expanded. */
export const setPromptCollectionContentSectionExpandedStateWithAutosave = (
  workspaceId: string,
  contentOwnerId: string,
  contentSectionIsExpanded: boolean
): void => {
  setPromptCollectionUiStateFieldsWithAutosave(workspaceId, contentOwnerId, {
    contentSectionIsExpanded
  })
}

/** Flushes every pending split workspace UI-state autosave. */
export const flushWorkspaceUiStateAutosaves = async (): Promise<void> => {
  /** Pending autosave keys collected from every split workspace UI-state collection. */
  const targets = [
    ...workspaceUiStateCollection.toArray.map((record) => [workspaceUiStateCollection.id, record.workspaceId]),
    ...workspacePromptCollectionUiStateCollection.toArray.map((record) => [
      workspacePromptCollectionUiStateCollection.id,
      createWorkspacePromptCollectionUiStateKey(record.workspaceId, record.contentOwnerId)
    ]),
    ...accordionUiStateCollection.toArray.map((record) => [
      accordionUiStateCollection.id,
      createAccordionUiStateKey(record.workspaceId, record.persistenceId)
    ])
  ] as Array<[string, string]>
  await Promise.allSettled(
    targets.map(([collectionId, elementId]) =>
      submitPacedUpdateTransactionAndWait(collectionId, elementId)
    )
  )
}
