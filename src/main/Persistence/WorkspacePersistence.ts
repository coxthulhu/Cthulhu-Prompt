import type { Workspace } from '@shared/Workspace'
import { readPromptFolders, readWorkspaceInfo } from '../DataAccess/WorkspaceReads'
import { createPersistenceStageResult, type PersistenceLayer } from './PersistenceTypes'
import {
  commitStagedFileChanges,
  createStagedFileRemove,
  createStagedFileUpsert,
  revertStagedFileChanges,
  resolveTempPath,
  writeJsonFile
} from './FilePersistenceHelpers'

export type WorkspacePersistenceFields = {
  workspacePath: string
  workspaceInfoPath: string
}

export const workspacePersistence: PersistenceLayer<Workspace, WorkspacePersistenceFields> = {
  stageChanges: async (change) => {
    const targetPath = change.persistenceFields.workspaceInfoPath

    if (change.type === 'remove') {
      return createPersistenceStageResult([createStagedFileRemove(targetPath)])
    }

    const tempPath = resolveTempPath(targetPath)
    writeJsonFile(tempPath, {
      workspaceId: change.data.id,
      workspaceName: change.data.workspaceName
    })

    return createPersistenceStageResult([createStagedFileUpsert(targetPath, tempPath)])
  },
  commitChanges: async (stagedChange) => {
    commitStagedFileChanges(stagedChange)
  },
  revertChanges: async (stagedChange) => {
    revertStagedFileChanges(stagedChange)
  },
  loadData: async (persistenceFields) => {
    const { workspacePath, workspaceInfoPath } = persistenceFields
    const workspaceInfo = readWorkspaceInfo(workspaceInfoPath)
    const promptFolders = readPromptFolders(workspacePath)

    return {
      id: workspaceInfo.workspaceId,
      workspacePath,
      workspaceName: workspaceInfo.workspaceName,
      promptFolderIds: promptFolders.map((promptFolder) => promptFolder.id)
    }
  }
}
