import type { WorkspacePromptFolderOutlinerEntry } from '@shared/UserPersistence'
import { AUTOSAVE_MS } from '@renderer/data/draftAutosave'
import { workspacePersistenceDraftCollection } from '../Collections/WorkspacePersistenceDraftCollection'
import { workspacePersistenceCollection } from '../Collections/WorkspacePersistenceCollection'
import { submitPacedUpdateTransactionAndWait } from '../IpcFramework/RevisionCollections'
import { mutatePacedWorkspacePersistenceAutosaveUpdate } from '../Mutations/WorkspacePersistenceMutations'

const upsertPromptFolderOutlinerEntry = (
  entries: WorkspacePromptFolderOutlinerEntry[],
  promptFolderId: string,
  outlinerEntryId: string
): WorkspacePromptFolderOutlinerEntry[] => {
  const existingIndex = entries.findIndex((entry) => entry.promptFolderId === promptFolderId)

  if (existingIndex === -1) {
    return [...entries, { promptFolderId, outlinerEntryId }]
  }

  if (entries[existingIndex]?.outlinerEntryId === outlinerEntryId) {
    return entries
  }

  const nextEntries = [...entries]
  nextEntries[existingIndex] = { promptFolderId, outlinerEntryId }
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

export const flushWorkspacePersistenceAutosaves = async (): Promise<void> => {
  const tasks = workspacePersistenceDraftCollection.toArray.map(async (draftRecord) => {
    await submitPacedUpdateTransactionAndWait(workspacePersistenceCollection.id, draftRecord.id)
  })
  await Promise.allSettled(tasks)
}
