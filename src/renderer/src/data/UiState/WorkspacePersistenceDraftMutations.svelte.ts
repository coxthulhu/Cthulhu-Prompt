import {
  cloneWorkspacePromptFolderPromptTreeEntries,
  type WorkspacePersistence
} from '@shared/UserPersistence'
import { workspacePersistenceDraftCollection } from '../Collections/WorkspacePersistenceDraftCollection'

export const upsertWorkspacePersistenceDraft = (
  workspacePersistence: WorkspacePersistence
): void => {
  const existingRecord = workspacePersistenceDraftCollection.get(workspacePersistence.workspaceId)

  if (!existingRecord) {
    workspacePersistenceDraftCollection.insert({
      id: workspacePersistence.workspaceId,
      selectedScreen: workspacePersistence.selectedScreen,
      selectedPromptFolderId: workspacePersistence.selectedPromptFolderId,
      promptFolderPromptTreeEntries: cloneWorkspacePromptFolderPromptTreeEntries(
        workspacePersistence.promptFolderPromptTreeEntries
      )
    })
    return
  }

  workspacePersistenceDraftCollection.update(workspacePersistence.workspaceId, (draftRecord) => {
    draftRecord.selectedScreen = workspacePersistence.selectedScreen
    draftRecord.selectedPromptFolderId = workspacePersistence.selectedPromptFolderId
    draftRecord.promptFolderPromptTreeEntries = cloneWorkspacePromptFolderPromptTreeEntries(
      workspacePersistence.promptFolderPromptTreeEntries
    )
  })
}
