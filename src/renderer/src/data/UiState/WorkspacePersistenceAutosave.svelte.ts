import type { WorkspacePromptFolderOutlinerEntry } from '@shared/UserPersistence'
import { AUTOSAVE_MS } from '@renderer/data/draftAutosave'
import { workspacePersistenceDraftCollection } from '../Collections/WorkspacePersistenceDraftCollection'
import { workspacePersistenceCollection } from '../Collections/WorkspacePersistenceCollection'
import { submitPacedUpdateTransactionAndWait } from '../IpcFramework/RevisionCollections'
import { mutatePacedWorkspacePersistenceAutosaveUpdate } from '../Mutations/WorkspacePersistenceMutations'

const DEFAULT_OUTLINER_ENTRY_ID = 'folder-settings'

const upsertPromptFolderOutlinerEntry = (
  entries: WorkspacePromptFolderOutlinerEntry[],
  promptFolderId: string,
  outlinerEntryId: string
): WorkspacePromptFolderOutlinerEntry[] => {
  const existingIndex = entries.findIndex((entry) => entry.promptFolderId === promptFolderId)

  if (existingIndex === -1) {
    return [
      ...entries,
      {
        promptFolderId,
        outlinerEntryId,
        folderDescriptionEditorViewStateJson: null
      }
    ]
  }

  if (entries[existingIndex]?.outlinerEntryId === outlinerEntryId) {
    return entries
  }

  const nextEntries = [...entries]
  nextEntries[existingIndex] = {
    ...nextEntries[existingIndex],
    promptFolderId,
    outlinerEntryId
  }
  return nextEntries
}

const applyPromptFolderOutlinerEntry = (
  record: { promptFolderOutlinerEntries: WorkspacePromptFolderOutlinerEntry[] },
  promptFolderId: string,
  outlinerEntryId: string
): void => {
  record.promptFolderOutlinerEntries = upsertPromptFolderOutlinerEntry(
    record.promptFolderOutlinerEntries,
    promptFolderId,
    outlinerEntryId
  )
}

const upsertPromptFolderDescriptionEditorViewState = (
  entries: WorkspacePromptFolderOutlinerEntry[],
  promptFolderId: string,
  viewStateJson: string
): WorkspacePromptFolderOutlinerEntry[] => {
  const existingIndex = entries.findIndex((entry) => entry.promptFolderId === promptFolderId)

  if (existingIndex === -1) {
    return [
      ...entries,
      {
        promptFolderId,
        outlinerEntryId: DEFAULT_OUTLINER_ENTRY_ID,
        folderDescriptionEditorViewStateJson: viewStateJson
      }
    ]
  }

  if (entries[existingIndex]?.folderDescriptionEditorViewStateJson === viewStateJson) {
    return entries
  }

  const nextEntries = [...entries]
  nextEntries[existingIndex] = {
    ...nextEntries[existingIndex],
    promptFolderId,
    folderDescriptionEditorViewStateJson: viewStateJson
  }
  return nextEntries
}

const applyPromptFolderDescriptionEditorViewState = (
  record: { promptFolderOutlinerEntries: WorkspacePromptFolderOutlinerEntry[] },
  promptFolderId: string,
  viewStateJson: string
): void => {
  record.promptFolderOutlinerEntries = upsertPromptFolderDescriptionEditorViewState(
    record.promptFolderOutlinerEntries,
    promptFolderId,
    viewStateJson
  )
}

export const lookupWorkspacePersistedPromptFolderOutlinerEntryId = (
  workspaceId: string,
  promptFolderId: string
): string | null => {
  const draftRecord = workspacePersistenceDraftCollection.get(workspaceId)
  if (!draftRecord) {
    return null
  }

  const persistedEntry = draftRecord.promptFolderOutlinerEntries.find(
    (entry) => entry.promptFolderId === promptFolderId
  )
  return persistedEntry?.outlinerEntryId ?? null
}

export const lookupWorkspacePersistedPromptFolderDescriptionEditorViewStateJson = (
  workspaceId: string,
  promptFolderId: string
): string | null => {
  const draftRecord = workspacePersistenceDraftCollection.get(workspaceId)
  if (!draftRecord) {
    return null
  }

  const persistedEntry = draftRecord.promptFolderOutlinerEntries.find(
    (entry) => entry.promptFolderId === promptFolderId
  )
  return persistedEntry?.folderDescriptionEditorViewStateJson ?? null
}

export const setPromptFolderOutlinerEntryIdWithAutosave = (
  workspaceId: string,
  promptFolderId: string,
  outlinerEntryId: string
): void => {
  const draftRecord = workspacePersistenceDraftCollection.get(workspaceId)
  if (!draftRecord) {
    return
  }

  const nextEntries = upsertPromptFolderOutlinerEntry(
    draftRecord.promptFolderOutlinerEntries,
    promptFolderId,
    outlinerEntryId
  )
  if (nextEntries === draftRecord.promptFolderOutlinerEntries) {
    return
  }

  mutatePacedWorkspacePersistenceAutosaveUpdate({
    workspaceId,
    debounceMs: AUTOSAVE_MS,
    mutateOptimistically: ({ collections }) => {
      collections.workspacePersistence.update(workspaceId, (draft) => {
        applyPromptFolderOutlinerEntry(draft, promptFolderId, outlinerEntryId)
      })
      collections.workspacePersistenceDraft.update(workspaceId, (draft) => {
        applyPromptFolderOutlinerEntry(draft, promptFolderId, outlinerEntryId)
      })
    }
  })
}

export const setPromptFolderDescriptionEditorViewStateWithAutosave = (
  workspaceId: string,
  promptFolderId: string,
  viewStateJson: string | null
): void => {
  if (viewStateJson === null) {
    return
  }

  const draftRecord = workspacePersistenceDraftCollection.get(workspaceId)
  if (!draftRecord) {
    return
  }

  const nextEntries = upsertPromptFolderDescriptionEditorViewState(
    draftRecord.promptFolderOutlinerEntries,
    promptFolderId,
    viewStateJson
  )
  if (nextEntries === draftRecord.promptFolderOutlinerEntries) {
    return
  }

  mutatePacedWorkspacePersistenceAutosaveUpdate({
    workspaceId,
    debounceMs: AUTOSAVE_MS,
    mutateOptimistically: ({ collections }) => {
      collections.workspacePersistence.update(workspaceId, (draft) => {
        applyPromptFolderDescriptionEditorViewState(draft, promptFolderId, viewStateJson)
      })
      collections.workspacePersistenceDraft.update(workspaceId, (draft) => {
        applyPromptFolderDescriptionEditorViewState(draft, promptFolderId, viewStateJson)
      })
    }
  })
}

export const flushWorkspacePersistenceAutosaves = async (): Promise<void> => {
  const tasks = workspacePersistenceDraftCollection.toArray.map(async (draftRecord) => {
    await submitPacedUpdateTransactionAndWait(workspacePersistenceCollection.id, draftRecord.id)
  })
  await Promise.allSettled(tasks)
}
