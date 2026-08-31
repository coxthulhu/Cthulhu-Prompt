import type {
  WorkspaceAccordionViewEntry,
  WorkspacePromptFolderViewEntry
} from '@shared/UserPersistence'
import { AUTOSAVE_MS } from '@renderer/data/draftAutosave'
import { workspacePersistenceCollection } from '../Collections/WorkspacePersistenceCollection'
import { submitPacedUpdateTransactionAndWait } from '../IpcFramework/RevisionCollections'
import { mutatePacedWorkspacePersistenceAutosaveUpdate } from '../Mutations/WorkspacePersistenceMutations'

/** Default selection stored before a prompt-folder screen has an explicit row selection. */
const DEFAULT_SELECTED_ENTRY_ID = 'root-header'
/** Default sidebar expansion for a newly observed category. */
const DEFAULT_TREE_IS_EXPANDED = true
/** Default details expansion for a newly observed category. */
const DEFAULT_DETAILS_SECTION_IS_EXPANDED = false
/** Default content expansion for a newly observed category. */
const DEFAULT_CONTENT_SECTION_IS_EXPANDED = true

/** Creates persisted view state for one root-content or category owner. */
const createPromptFolderViewEntry = (
  contentOwnerId: string,
  overrides: Partial<WorkspacePromptFolderViewEntry> = {}
): WorkspacePromptFolderViewEntry => ({
  contentOwnerId,
  selectedEntryId: DEFAULT_SELECTED_ENTRY_ID,
  treeIsExpanded: DEFAULT_TREE_IS_EXPANDED,
  detailsSectionIsExpanded: DEFAULT_DETAILS_SECTION_IS_EXPANDED,
  contentSectionIsExpanded: DEFAULT_CONTENT_SECTION_IS_EXPANDED,
  categoryDescriptionEditorViewStateJson: null,
  ...overrides
})

/** Returns entries with one content owner's persisted view state updated. */
const upsertPromptFolderViewEntry = (
  entries: WorkspacePromptFolderViewEntry[],
  contentOwnerId: string,
  updates: Partial<WorkspacePromptFolderViewEntry>
): WorkspacePromptFolderViewEntry[] => {
  const existingIndex = entries.findIndex((entry) => entry.contentOwnerId === contentOwnerId)
  if (existingIndex === -1) {
    return [...entries, createPromptFolderViewEntry(contentOwnerId, updates)]
  }

  const existingEntry = entries[existingIndex]!
  const hasChanges = Object.entries(updates).some(
    ([key, value]) => existingEntry[key as keyof WorkspacePromptFolderViewEntry] !== value
  )
  if (!hasChanges) return entries

  const nextEntries = [...entries]
  nextEntries[existingIndex] = { ...existingEntry, ...updates, contentOwnerId }
  return nextEntries
}

/** Applies one content owner's persisted view-state update to a draft record. */
const applyPromptFolderViewEntry = (
  record: { promptFolderViewEntries: WorkspacePromptFolderViewEntry[] },
  contentOwnerId: string,
  updates: Partial<WorkspacePromptFolderViewEntry>
): void => {
  record.promptFolderViewEntries = upsertPromptFolderViewEntry(
    record.promptFolderViewEntries,
    contentOwnerId,
    updates
  )
}

/** Looks up persisted view state for one root-content or category owner. */
const lookupPromptFolderViewEntry = (
  workspaceId: string,
  contentOwnerId: string
): WorkspacePromptFolderViewEntry | null =>
  workspacePersistenceCollection
    .get(workspaceId)
    ?.promptFolderViewEntries.find((entry) => entry.contentOwnerId === contentOwnerId) ?? null

/** Queues one content owner's view-state update and optionally marks it active for a root folder. */
const setPromptFolderViewEntryWithAutosave = (
  workspaceId: string,
  contentOwnerId: string,
  updates: Partial<WorkspacePromptFolderViewEntry>,
  selectedPromptFolderId?: string
): void => {
  /** Current workspace persistence used to detect an unchanged view entry. */
  const workspacePersistence = workspacePersistenceCollection.get(workspaceId)
  if (!workspacePersistence) return

  const nextEntries = upsertPromptFolderViewEntry(
    workspacePersistence.promptFolderViewEntries,
    contentOwnerId,
    updates
  )
  /** Whether this selection changes only the root folder's active-owner pointer. */
  const selectedContentOwnerHasChanged =
    Boolean(selectedPromptFolderId) &&
    workspacePersistence.selectedScreen === 'prompt-folders' &&
    workspacePersistence.selectedScreenData.promptFolderId === selectedPromptFolderId &&
    workspacePersistence.selectedScreenData.contentOwnerId !== contentOwnerId
  if (
    nextEntries === workspacePersistence.promptFolderViewEntries &&
    !selectedContentOwnerHasChanged
  ) {
    return
  }

  mutatePacedWorkspacePersistenceAutosaveUpdate({
    workspaceId,
    debounceMs: AUTOSAVE_MS,
    mutateOptimistically: ({ collections }) => {
      collections.workspacePersistence.update(workspaceId, (draft) => {
        applyPromptFolderViewEntry(draft, contentOwnerId, updates)
        if (
          selectedPromptFolderId &&
          draft.selectedScreen === 'prompt-folders' &&
          draft.selectedScreenData.promptFolderId === selectedPromptFolderId
        ) {
          draft.selectedScreenData.contentOwnerId = contentOwnerId
        }
      })
    }
  })
}

/** Returns entries with one accordion instance's complete section state updated. */
const upsertAccordionViewEntry = (
  entries: WorkspaceAccordionViewEntry[],
  accordionViewEntry: WorkspaceAccordionViewEntry
): WorkspaceAccordionViewEntry[] => {
  /** Existing entry position for the target accordion instance. */
  const existingIndex = entries.findIndex(
    (entry) => entry.persistenceId === accordionViewEntry.persistenceId
  )
  /** Independent copy of the complete requested accordion state. */
  const nextEntry = {
    persistenceId: accordionViewEntry.persistenceId,
    sections: accordionViewEntry.sections.map((section) => ({ ...section }))
  }
  if (existingIndex === -1) {
    return [...entries, nextEntry]
  }

  /** Serialized values used to avoid a redundant complete-accordion persistence write. */
  const existingJson = JSON.stringify(entries[existingIndex])
  /** Serialized requested value compared with the existing accordion entry. */
  const nextJson = JSON.stringify(nextEntry)
  if (existingJson === nextJson) return entries

  /** Updated accordion entries preserving every other persistence ID. */
  const nextEntries = [...entries]
  nextEntries[existingIndex] = nextEntry
  return nextEntries
}

/** Applies one accordion instance's complete section state to a persistence record. */
const applyAccordionViewEntry = (
  record: { accordionViewEntries: WorkspaceAccordionViewEntry[] },
  accordionViewEntry: WorkspaceAccordionViewEntry
): void => {
  record.accordionViewEntries = upsertAccordionViewEntry(
    record.accordionViewEntries,
    accordionViewEntry
  )
}

/** Looks up the complete saved state for one workspace accordion instance. */
export const lookupWorkspacePersistedAccordionViewEntry = (
  workspaceId: string,
  persistenceId: string
): WorkspaceAccordionViewEntry | null => {
  /** Saved accordion entry for the requested persistence ID. */
  const entry = workspacePersistenceCollection
    .get(workspaceId)
    ?.accordionViewEntries.find((candidate) => candidate.persistenceId === persistenceId)
  return entry
    ? {
        persistenceId: entry.persistenceId,
        sections: entry.sections.map((section) => ({ ...section }))
      }
    : null
}

/** Persists one complete accordion instance through the workspace autosave. */
export const setAccordionViewEntryWithAutosave = (
  workspaceId: string,
  accordionViewEntry: WorkspaceAccordionViewEntry
): void => {
  /** Current workspace persistence record used to detect unchanged accordion state. */
  const workspacePersistence = workspacePersistenceCollection.get(workspaceId)
  if (!workspacePersistence) return

  /** Next accordion entries after applying the requested complete state. */
  const nextEntries = upsertAccordionViewEntry(
    workspacePersistence.accordionViewEntries,
    accordionViewEntry
  )
  if (nextEntries === workspacePersistence.accordionViewEntries) return

  mutatePacedWorkspacePersistenceAutosaveUpdate({
    workspaceId,
    debounceMs: AUTOSAVE_MS,
    mutateOptimistically: ({ collections }) => {
      collections.workspacePersistence.update(workspaceId, (draft) => {
        applyAccordionViewEntry(draft, accordionViewEntry)
      })
    }
  })
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
  const workspacePersistence = workspacePersistenceCollection.get(workspaceId)
  if (
    workspacePersistence?.selectedScreen !== 'prompt-folders' ||
    workspacePersistence.selectedScreenData.promptFolderId !== promptFolderId
  ) {
    return null
  }

  /** Persisted owner whose selected row should be restored. */
  const contentOwnerId = workspacePersistence.selectedScreenData.contentOwnerId
  if (!contentOwnerId) return null

  /** Per-owner view entry containing the selected category or prompt row. */
  const entry = lookupPromptFolderViewEntry(workspaceId, contentOwnerId)
  return entry ? { contentOwnerId, selectedEntryId: entry.selectedEntryId } : null
}

/** Looks up whether one category is expanded in the sidebar tree. */
export const lookupWorkspacePersistedCategoryTreeExpandedState = (
  workspaceId: string,
  categoryId: string
): boolean | null => lookupPromptFolderViewEntry(workspaceId, categoryId)?.treeIsExpanded ?? null

/** Looks up one category description editor's Monaco view state. */
export const lookupWorkspacePersistedCategoryDescriptionEditorViewStateJson = (
  workspaceId: string,
  categoryId: string
): string | null =>
  lookupPromptFolderViewEntry(workspaceId, categoryId)?.categoryDescriptionEditorViewStateJson ??
  null

/** Looks up whether one content owner's details section is expanded. */
export const lookupWorkspacePersistedPromptFolderDetailsSectionExpandedState = (
  workspaceId: string,
  contentOwnerId: string
): boolean | null =>
  lookupPromptFolderViewEntry(workspaceId, contentOwnerId)?.detailsSectionIsExpanded ?? null

/** Looks up whether one content owner's prompt or template section is expanded. */
export const lookupWorkspacePersistedPromptFolderContentSectionExpandedState = (
  workspaceId: string,
  contentOwnerId: string
): boolean | null =>
  lookupPromptFolderViewEntry(workspaceId, contentOwnerId)?.contentSectionIsExpanded ?? null

/** Persists the selected row and active owner for one root prompt-folder screen. */
export const setPromptFolderSelectedEntryIdWithAutosave = (
  workspaceId: string,
  promptFolderId: string,
  contentOwnerId: string,
  selectedEntryId: string
): void => {
  setPromptFolderViewEntryWithAutosave(
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
  setPromptFolderViewEntryWithAutosave(workspaceId, categoryId, { treeIsExpanded })
}

/** Persists whether one content owner's details section is expanded. */
export const setPromptFolderDetailsSectionExpandedStateWithAutosave = (
  workspaceId: string,
  contentOwnerId: string,
  detailsSectionIsExpanded: boolean
): void => {
  setPromptFolderViewEntryWithAutosave(workspaceId, contentOwnerId, {
    detailsSectionIsExpanded
  })
}

/** Persists whether one content owner's prompt or template section is expanded. */
export const setPromptFolderContentSectionExpandedStateWithAutosave = (
  workspaceId: string,
  contentOwnerId: string,
  contentSectionIsExpanded: boolean
): void => {
  setPromptFolderViewEntryWithAutosave(workspaceId, contentOwnerId, {
    contentSectionIsExpanded
  })
}

/** Persists one category description editor's Monaco view state. */
export const setCategoryDescriptionEditorViewStateWithAutosave = (
  workspaceId: string,
  categoryId: string,
  categoryDescriptionEditorViewStateJson: string | null
): void => {
  setPromptFolderViewEntryWithAutosave(workspaceId, categoryId, {
    categoryDescriptionEditorViewStateJson
  })
}

/** Flushes every pending workspace-persistence autosave. */
export const flushWorkspacePersistenceAutosaves = async (): Promise<void> => {
  /** Flush tasks for each loaded workspace-persistence record. */
  const tasks = workspacePersistenceCollection.toArray.map(async (workspacePersistence) => {
    await submitPacedUpdateTransactionAndWait(
      workspacePersistenceCollection.id,
      workspacePersistence.workspaceId
    )
  })
  await Promise.allSettled(tasks)
}
