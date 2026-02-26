import type { WorkspacePersistence } from '@shared/UserPersistence'
import { workspacePersistenceDraftCollection } from '../Collections/WorkspacePersistenceDraftCollection'

const clonePromptFolderOutlinerEntryIds = (workspacePersistence: WorkspacePersistence) => {
  return workspacePersistence.promptFolderOutlinerEntryIds.map((entry) => ({
    promptFolderId: entry.promptFolderId,
    outlinerEntryId: entry.outlinerEntryId
  }))
}

export const upsertWorkspacePersistenceDraft = (
  workspacePersistence: WorkspacePersistence
): void => {
  const existingRecord = workspacePersistenceDraftCollection.get(workspacePersistence.workspaceId)

  if (!existingRecord) {
    workspacePersistenceDraftCollection.insert({
      id: workspacePersistence.workspaceId,
      selectedScreen: workspacePersistence.selectedScreen,
      selectedPromptFolderId: workspacePersistence.selectedPromptFolderId,
      promptFolderOutlinerEntryIds: clonePromptFolderOutlinerEntryIds(workspacePersistence)
    })
    return
  }

  workspacePersistenceDraftCollection.update(workspacePersistence.workspaceId, (draftRecord) => {
    draftRecord.selectedScreen = workspacePersistence.selectedScreen
    draftRecord.selectedPromptFolderId = workspacePersistence.selectedPromptFolderId
    draftRecord.promptFolderOutlinerEntryIds = clonePromptFolderOutlinerEntryIds(workspacePersistence)
  })
}
