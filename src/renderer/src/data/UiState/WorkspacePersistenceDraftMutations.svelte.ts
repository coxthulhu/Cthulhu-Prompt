import {
  cloneWorkspaceAccordionViewEntries,
  cloneWorkspacePromptFolderViewEntries,
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
      lastPromptFolderId: workspacePersistence.lastPromptFolderId,
      promptFolderViewEntries: cloneWorkspacePromptFolderViewEntries(
        workspacePersistence.promptFolderViewEntries
      ),
      accordionViewEntries: cloneWorkspaceAccordionViewEntries(
        workspacePersistence.accordionViewEntries
      )
    } as WorkspacePersistenceDraftRecord)
    return
  }

  workspacePersistenceDraftCollection.update(workspacePersistence.workspaceId, (draftRecord) => {
    Object.assign(draftRecord, {
      selectedScreen: workspacePersistence.selectedScreen,
      selectedScreenData: workspacePersistence.selectedScreenData,
      lastPromptFolderId: workspacePersistence.lastPromptFolderId
    })
    draftRecord.promptFolderViewEntries = cloneWorkspacePromptFolderViewEntries(
      workspacePersistence.promptFolderViewEntries
    )
    draftRecord.accordionViewEntries = cloneWorkspaceAccordionViewEntries(
      workspacePersistence.accordionViewEntries
    )
  })
}
