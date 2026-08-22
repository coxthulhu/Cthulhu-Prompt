import type {
  WorkspaceAccordionViewEntry,
  WorkspacePromptFolderViewEntry
} from '@shared/UserPersistence'
import { AUTOSAVE_MS } from '@renderer/data/draftAutosave'
import { workspacePersistenceDraftCollection } from '../Collections/WorkspacePersistenceDraftCollection'
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
  workspacePersistenceDraftCollection
    .get(workspaceId)
    ?.promptFolderViewEntries.find((entry) => entry.contentOwnerId === contentOwnerId) ?? null

/** Queues one content owner's persisted view-state update. */
const setPromptFolderViewEntryWithAutosave = (
  workspaceId: string,
  contentOwnerId: string,
  updates: Partial<WorkspacePromptFolderViewEntry>
): void => {
  const draftRecord = workspacePersistenceDraftCollection.get(workspaceId)
  if (!draftRecord) return

  const nextEntries = upsertPromptFolderViewEntry(
    draftRecord.promptFolderViewEntries,
    contentOwnerId,
    updates
  )
  if (nextEntries === draftRecord.promptFolderViewEntries) return

  mutatePacedWorkspacePersistenceAutosaveUpdate({
    workspaceId,
    debounceMs: AUTOSAVE_MS,
    mutateOptimistically: ({ collections }) => {
      collections.workspacePersistence.update(workspaceId, (draft) => {
        applyPromptFolderViewEntry(draft, contentOwnerId, updates)
      })
      collections.workspacePersistenceDraft.update(workspaceId, (draft) => {
        applyPromptFolderViewEntry(draft, contentOwnerId, updates)
      })
    }
  })
}

/** Returns entries with one accordion instance's expanded section IDs updated. */
const upsertAccordionViewEntry = (
  entries: WorkspaceAccordionViewEntry[],
  persistenceId: string,
  expandedSectionIds: string[]
): WorkspaceAccordionViewEntry[] => {
  /** Existing entry position for the target accordion instance. */
  const existingIndex = entries.findIndex((entry) => entry.persistenceId === persistenceId)
  if (existingIndex === -1) {
    return [...entries, { persistenceId, expandedSectionIds: [...expandedSectionIds] }]
  }

  /** Existing expanded IDs used to avoid redundant persistence writes. */
  const existingSectionIds = entries[existingIndex]!.expandedSectionIds
  if (
    existingSectionIds.length === expandedSectionIds.length &&
    existingSectionIds.every((sectionId, index) => sectionId === expandedSectionIds[index])
  ) {
    return entries
  }

  /** Updated accordion entries preserving every other persistence ID. */
  const nextEntries = [...entries]
  nextEntries[existingIndex] = { persistenceId, expandedSectionIds: [...expandedSectionIds] }
  return nextEntries
}

/** Applies one accordion instance's expanded section IDs to a persistence record. */
const applyAccordionViewEntry = (
  record: { accordionViewEntries: WorkspaceAccordionViewEntry[] },
  persistenceId: string,
  expandedSectionIds: string[]
): void => {
  record.accordionViewEntries = upsertAccordionViewEntry(
    record.accordionViewEntries,
    persistenceId,
    expandedSectionIds
  )
}

/** Looks up saved expanded section IDs for one workspace accordion instance. */
export const lookupWorkspacePersistedAccordionExpandedSectionIds = (
  workspaceId: string,
  persistenceId: string
): string[] | null => {
  /** Saved accordion entry for the requested persistence ID. */
  const entry = workspacePersistenceDraftCollection
    .get(workspaceId)
    ?.accordionViewEntries.find((candidate) => candidate.persistenceId === persistenceId)
  return entry ? [...entry.expandedSectionIds] : null
}

/** Persists expanded section IDs for one workspace accordion instance. */
export const setAccordionExpandedSectionIdsWithAutosave = (
  workspaceId: string,
  persistenceId: string,
  expandedSectionIds: string[]
): void => {
  /** Current workspace persistence draft used to detect unchanged expansion state. */
  const draftRecord = workspacePersistenceDraftCollection.get(workspaceId)
  if (!draftRecord) return

  /** Next accordion entries after applying the requested expansion state. */
  const nextEntries = upsertAccordionViewEntry(
    draftRecord.accordionViewEntries,
    persistenceId,
    expandedSectionIds
  )
  if (nextEntries === draftRecord.accordionViewEntries) return

  mutatePacedWorkspacePersistenceAutosaveUpdate({
    workspaceId,
    debounceMs: AUTOSAVE_MS,
    mutateOptimistically: ({ collections }) => {
      collections.workspacePersistence.update(workspaceId, (draft) => {
        applyAccordionViewEntry(draft, persistenceId, expandedSectionIds)
      })
      collections.workspacePersistenceDraft.update(workspaceId, (draft) => {
        applyAccordionViewEntry(draft, persistenceId, expandedSectionIds)
      })
    }
  })
}

/** Looks up the selected screen entry for one content owner. */
export const lookupWorkspacePersistedPromptFolderSelectedEntryId = (
  workspaceId: string,
  contentOwnerId: string
): string | null => lookupPromptFolderViewEntry(workspaceId, contentOwnerId)?.selectedEntryId ?? null

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

/** Persists the selected screen entry for one content owner. */
export const setPromptFolderSelectedEntryIdWithAutosave = (
  workspaceId: string,
  contentOwnerId: string,
  selectedEntryId: string
): void => {
  setPromptFolderViewEntryWithAutosave(workspaceId, contentOwnerId, { selectedEntryId })
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
  const tasks = workspacePersistenceDraftCollection.toArray.map(async (draftRecord) => {
    await submitPacedUpdateTransactionAndWait(workspacePersistenceCollection.id, draftRecord.id)
  })
  await Promise.allSettled(tasks)
}
