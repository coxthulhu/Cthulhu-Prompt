import { AUTOSAVE_MS } from '@renderer/data/UiState/autosave/draftAutosave'
import { PromptStatusFolderId } from '@shared/domain/prompt/Prompt'
import {
  isPromptFolderScreenSelection,
  type WorkspaceAccordionSectionViewEntry
} from '@shared/domain/user-persistence/UserPersistence'
import {
  createAccordionUiStateKey,
  createWorkspacePromptFolderUiStateKey,
  type AccordionUiState,
  type WorkspacePromptFolderUiState
} from '@shared/domain/ui-state/UiState'
import { accordionUiStateCollection } from '@renderer/data/Collections/AccordionUiStateCollection'
import { workspacePromptFolderUiStateCollection } from '@renderer/data/Collections/WorkspacePromptFolderUiStateCollection'
import { workspaceUiStateCollection } from '@renderer/data/Collections/WorkspaceUiStateCollection'
import { submitPacedUpdateTransactionAndWait } from '@renderer/data/IpcFramework/RevisionCollections'
import {
  setAccordionUiStateWithAutosave,
  setWorkspacePromptFolderUiStateWithAutosave,
  setWorkspaceUiStateWithAutosave
} from '@renderer/data/Mutations/WorkspaceUiStateMutations'

/** Default selection stored before a content owner has an explicit row selection. */
const DEFAULT_SELECTED_ENTRY_ID = 'root-header'
/** Default sidebar expansion for a newly observed content owner. */
const DEFAULT_TREE_IS_EXPANDED = true
/** Default content expansion for a newly observed content owner. */
const DEFAULT_CONTENT_SECTION_IS_EXPANDED = true

/** Creates default prompt-folder view state for one root or category owner. */
const createPromptFolderUiState = (
  workspaceId: string,
  contentOwnerId: string
): WorkspacePromptFolderUiState => ({
  workspaceId,
  contentOwnerId,
  selectedEntryId: DEFAULT_SELECTED_ENTRY_ID,
  treeIsExpanded: DEFAULT_TREE_IS_EXPANDED,
  contentSectionIsExpanded: DEFAULT_CONTENT_SECTION_IS_EXPANDED,
  scrollTopByMode: {},
  selectedMode: PromptStatusFolderId.Active,
  shownFinalStatusGroups: {}
})

/** Reads one root or category prompt-folder view state by its composite key. */
export const lookupPromptFolderUiState = (
  workspaceId: string,
  contentOwnerId: string
): WorkspacePromptFolderUiState | null =>
  workspacePromptFolderUiStateCollection.get(
    createWorkspacePromptFolderUiStateKey(workspaceId, contentOwnerId)
  ) ?? null

/** Queues one content owner's changed view fields and optional active-owner pointer. */
const setPromptFolderUiStateFieldsWithAutosave = (
  workspaceId: string,
  contentOwnerId: string,
  updates: Partial<
    Pick<
      WorkspacePromptFolderUiState,
      | 'selectedEntryId'
      | 'treeIsExpanded'
      | 'contentSectionIsExpanded'
      | 'scrollTopByMode'
      | 'selectedMode'
      | 'shownFinalStatusGroups'
    >
  >,
  selectedPromptFolderId?: string
): void => {
  /** Current or default owner state used to build a complete replacement command. */
  const current =
    lookupPromptFolderUiState(workspaceId, contentOwnerId) ??
    createPromptFolderUiState(workspaceId, contentOwnerId)
  /** Complete desired owner state after applying the requested fields. */
  const next = { ...current, ...updates }
  /** Whether at least one persisted owner field changed. */
  const hasOwnerChange = Object.entries(updates).some(
    ([key, value]) => current[key as keyof WorkspacePromptFolderUiState] !== value
  )
  if (hasOwnerChange) {
    setWorkspacePromptFolderUiStateWithAutosave(next, AUTOSAVE_MS)
  }

  /** Current workspace screen state whose active owner may change separately. */
  const workspaceUiState = workspaceUiStateCollection.get(workspaceId)
  if (
    selectedPromptFolderId &&
    workspaceUiState &&
    isPromptFolderScreenSelection(workspaceUiState) &&
    workspaceUiState.selectedScreenData.promptFolderId === selectedPromptFolderId &&
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

/** Saves root-specific navigation without changing selection, scroll, or accordion sizing. */
export const setPromptFolderStatusNavigationWithAutosave = (
  workspaceId: string,
  promptFolderId: string,
  selectedMode: PromptStatusFolderId,
  shownFinalStatusGroups: WorkspacePromptFolderUiState['shownFinalStatusGroups']
): void => {
  setPromptFolderUiStateFieldsWithAutosave(workspaceId, promptFolderId, {
    selectedMode,
    shownFinalStatusGroups: { ...shownFinalStatusGroups }
  })
}

/** Workspace-wide accordion shared by the root folders' status trees. */
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
export const lookupPromptFolderScrollTop = (
  workspaceId: string,
  promptFolderId: string,
  mode: PromptStatusFolderId
): number | null =>
  lookupPromptFolderUiState(workspaceId, promptFolderId)?.scrollTopByMode[mode] ?? null

/** Saves one mode's reachable offset while retaining the folder's other UI state. */
export const setPromptFolderScrollTopWithAutosave = (
  workspaceId: string,
  promptFolderId: string,
  mode: PromptStatusFolderId,
  scrollTopPx: number
): void => {
  /** Latest optimistic offsets include other mode changes still awaiting autosave. */
  const current = lookupPromptFolderUiState(workspaceId, promptFolderId)?.scrollTopByMode ?? {}
  if (current[mode] === scrollTopPx) return
  setPromptFolderUiStateFieldsWithAutosave(workspaceId, promptFolderId, {
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

/** Persisted row selection and its root-folder or category owner. */
export type WorkspacePersistedPromptFolderSelection = {
  contentOwnerId: string
  selectedEntryId: string
}

/** Looks up the selected prompt-folder screen row and its persisted content owner. */
export const lookupWorkspacePersistedPromptFolderSelection = (
  workspaceId: string,
  promptFolderId: string
): WorkspacePersistedPromptFolderSelection | null => {
  /** Workspace screen state containing the active content-owner pointer. */
  const workspaceUiState = workspaceUiStateCollection.get(workspaceId)
  if (
    !workspaceUiState ||
    !isPromptFolderScreenSelection(workspaceUiState) ||
    workspaceUiState.selectedScreenData.promptFolderId !== promptFolderId
  ) {
    return null
  }
  /** Active content owner whose saved row selection should be restored. */
  const contentOwnerId = workspaceUiState.selectedScreenData.contentOwnerId
  if (!contentOwnerId) return null
  /** Per-owner state containing the saved row selection. */
  const entry = lookupPromptFolderUiState(workspaceId, contentOwnerId)
  return entry ? { contentOwnerId, selectedEntryId: entry.selectedEntryId } : null
}

/** Looks up whether one category is expanded in the sidebar tree. */
export const lookupWorkspacePersistedCategoryTreeExpandedState = (
  workspaceId: string,
  categoryId: string
): boolean | null => lookupPromptFolderUiState(workspaceId, categoryId)?.treeIsExpanded ?? null

/** Looks up whether one content owner's content section is expanded. */
export const lookupWorkspacePersistedPromptFolderContentSectionExpandedState = (
  workspaceId: string,
  contentOwnerId: string
): boolean | null =>
  lookupPromptFolderUiState(workspaceId, contentOwnerId)?.contentSectionIsExpanded ?? null

/** Persists the selected row and active owner for one root prompt-folder screen. */
export const setPromptFolderSelectedEntryIdWithAutosave = (
  workspaceId: string,
  promptFolderId: string,
  contentOwnerId: string,
  selectedEntryId: string
): void => {
  setPromptFolderUiStateFieldsWithAutosave(
    workspaceId,
    contentOwnerId,
    { selectedEntryId },
    promptFolderId
  )
}

/** Persists whether one category is expanded in the sidebar tree. */
export const setCategoryTreeExpandedStateWithAutosave = (
  workspaceId: string,
  categoryId: string,
  treeIsExpanded: boolean
): void => {
  setPromptFolderUiStateFieldsWithAutosave(workspaceId, categoryId, { treeIsExpanded })
}

/** Persists whether one content owner's content section is expanded. */
export const setPromptFolderContentSectionExpandedStateWithAutosave = (
  workspaceId: string,
  contentOwnerId: string,
  contentSectionIsExpanded: boolean
): void => {
  setPromptFolderUiStateFieldsWithAutosave(workspaceId, contentOwnerId, {
    contentSectionIsExpanded
  })
}

/** Flushes every pending split workspace UI-state autosave. */
export const flushWorkspaceUiStateAutosaves = async (): Promise<void> => {
  /** Pending autosave keys collected from every split workspace UI-state collection. */
  const targets = [
    ...workspaceUiStateCollection.toArray.map((record) => [workspaceUiStateCollection.id, record.workspaceId]),
    ...workspacePromptFolderUiStateCollection.toArray.map((record) => [
      workspacePromptFolderUiStateCollection.id,
      createWorkspacePromptFolderUiStateKey(record.workspaceId, record.contentOwnerId)
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
