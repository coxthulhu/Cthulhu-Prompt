import {
  cloneWorkspacePromptFolderPromptTreeEntries,
  type WorkspacePersistence
} from '@shared/UserPersistence'
import {
  workspacePersistenceDraftCollection,
  type WorkspacePersistenceDraftRecord
} from '../Collections/WorkspacePersistenceDraftCollection'

export const upsertWorkspacePersistenceDraft = (
  workspacePersistence: WorkspacePersistence
): void => {
  const existingRecord = workspacePersistenceDraftCollection.get(workspacePersistence.workspaceId)

  if (!existingRecord) {
    workspacePersistenceDraftCollection.insert({
      id: workspacePersistence.workspaceId,
      selectedScreen: workspacePersistence.selectedScreen,
      selectedScreenData: workspacePersistence.selectedScreenData,
      promptFolderPromptTreeEntries: cloneWorkspacePromptFolderPromptTreeEntries(
        workspacePersistence.promptFolderPromptTreeEntries
      )
    } as WorkspacePersistenceDraftRecord)
    return
  }

  workspacePersistenceDraftCollection.update(workspacePersistence.workspaceId, (draftRecord) => {
    Object.assign(draftRecord, {
      selectedScreen: workspacePersistence.selectedScreen,
      selectedScreenData: workspacePersistence.selectedScreenData
    })
    draftRecord.promptFolderPromptTreeEntries = cloneWorkspacePromptFolderPromptTreeEntries(
      workspacePersistence.promptFolderPromptTreeEntries
    )
  })
}
