import { AUTOSAVE_MS } from '@renderer/data/draftAutosave'
import type { WorkspaceAccordionSectionViewEntry } from '@shared/UserPersistence'
import {
  createAccordionUiStateKey,
  createCategoryDescriptionEditorUiStateKey,
  createWorkspacePromptFolderUiStateKey,
  type AccordionUiState,
  type WorkspacePromptFolderUiState
} from '@shared/UiState'
import { accordionUiStateCollection } from '../Collections/AccordionUiStateCollection'
import { categoryDescriptionEditorUiStateCollection } from '../Collections/CategoryDescriptionEditorUiStateCollection'
import { workspacePromptFolderUiStateCollection } from '../Collections/WorkspacePromptFolderUiStateCollection'
import { workspaceUiStateCollection } from '../Collections/WorkspaceUiStateCollection'
import { submitPacedUpdateTransactionAndWait } from '../IpcFramework/RevisionCollections'
import {
  setAccordionUiStateWithAutosave,
  setCategoryDescriptionEditorUiStateWithAutosave as queueCategoryDescriptionEditorUiState,
  setWorkspacePromptFolderUiStateWithAutosave,
  setWorkspaceUiStateWithAutosave
} from '../Mutations/WorkspaceUiStateMutations'

/** Default selection stored before a content owner has an explicit row selection. */
const DEFAULT_SELECTED_ENTRY_ID = 'root-header'
/** Default sidebar expansion for a newly observed content owner. */
const DEFAULT_TREE_IS_EXPANDED = true
/** Default details expansion for a newly observed content owner. */
const DEFAULT_DETAILS_SECTION_IS_EXPANDED = false
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
  detailsSectionIsExpanded: DEFAULT_DETAILS_SECTION_IS_EXPANDED,
  contentSectionIsExpanded: DEFAULT_CONTENT_SECTION_IS_EXPANDED
})

/** Reads one root or category prompt-folder view state by its composite key. */
const lookupPromptFolderUiState = (
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
      | 'detailsSectionIsExpanded'
      | 'contentSectionIsExpanded'
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
    workspaceUiState?.selectedScreen === 'prompt-folders' &&
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
    workspaceUiState?.selectedScreen !== 'prompt-folders' ||
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

/** Looks up one category description editor's Monaco view state. */
export const lookupWorkspacePersistedCategoryDescriptionEditorViewStateJson = (
  workspaceId: string,
  categoryId: string
): string | null =>
  categoryDescriptionEditorUiStateCollection.get(
    createCategoryDescriptionEditorUiStateKey(workspaceId, categoryId)
  )?.editorViewStateJson ?? null

/** Looks up whether one content owner's details section is expanded. */
export const lookupWorkspacePersistedPromptFolderDetailsSectionExpandedState = (
  workspaceId: string,
  contentOwnerId: string
): boolean | null =>
  lookupPromptFolderUiState(workspaceId, contentOwnerId)?.detailsSectionIsExpanded ?? null

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

/** Persists whether one content owner's details section is expanded. */
export const setPromptFolderDetailsSectionExpandedStateWithAutosave = (
  workspaceId: string,
  contentOwnerId: string,
  detailsSectionIsExpanded: boolean
): void => {
  setPromptFolderUiStateFieldsWithAutosave(workspaceId, contentOwnerId, {
    detailsSectionIsExpanded
  })
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

/** Persists or removes one category description editor's Monaco view state. */
export const setCategoryDescriptionEditorViewStateWithAutosave = (
  workspaceId: string,
  categoryId: string,
  editorViewStateJson: string | null
): void => {
  /** Composite key used to skip redundant nullable editor state changes. */
  const id = createCategoryDescriptionEditorUiStateKey(workspaceId, categoryId)
  /** Current authoritative or optimistic editor state. */
  const current = categoryDescriptionEditorUiStateCollection.get(id)
  if (current?.editorViewStateJson === editorViewStateJson || (!current && editorViewStateJson === null)) {
    return
  }
  queueCategoryDescriptionEditorUiState(
    { workspaceId, categoryId, editorViewStateJson },
    AUTOSAVE_MS
  )
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
    ]),
    ...categoryDescriptionEditorUiStateCollection.toArray.map((record) => [
      categoryDescriptionEditorUiStateCollection.id,
      createCategoryDescriptionEditorUiStateKey(record.workspaceId, record.categoryId)
    ])
  ] as Array<[string, string]>
  await Promise.allSettled(
    targets.map(([collectionId, elementId]) =>
      submitPacedUpdateTransactionAndWait(collectionId, elementId)
    )
  )
}
