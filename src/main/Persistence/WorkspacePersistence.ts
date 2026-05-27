import type { Workspace } from '@shared/Workspace'
import type { WorkspacePromptFolderOrderFile } from '../DiskTypes/WorkspaceDiskTypes'
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
import { resolveWorkspacePromptFolderOrderPath } from './PromptPersistencePaths'

export type WorkspacePersistenceFields = {
  workspacePath: string
  workspaceInfoPath: string
}

const toWorkspacePromptFolderOrderFile = (
  promptFolderIds: string[]
): WorkspacePromptFolderOrderFile => {
  return { promptFolderIds }
}

export const workspacePersistence: PersistenceLayer<Workspace, WorkspacePersistenceFields> = {
  stageChanges: async (change) => {
    const infoPath = change.persistenceFields.workspaceInfoPath
    const folderOrderPath = resolveWorkspacePromptFolderOrderPath(
      change.persistenceFields.workspacePath
    )

    if (change.type === 'remove') {
      return createPersistenceStageResult([
        createStagedFileRemove(infoPath),
        createStagedFileRemove(folderOrderPath)
      ])
    }

    const infoTempPath = resolveTempPath(infoPath)
    writeJsonFile(infoTempPath, {
      workspaceId: change.data.id,
      workspaceName: change.data.workspaceName
    })
    const folderOrderTempPath = resolveTempPath(folderOrderPath)
    writeJsonFile(
      folderOrderTempPath,
      toWorkspacePromptFolderOrderFile(change.data.promptFolderIds)
    )

    return createPersistenceStageResult([
      createStagedFileUpsert(infoPath, infoTempPath),
      createStagedFileUpsert(folderOrderPath, folderOrderTempPath)
    ])
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
