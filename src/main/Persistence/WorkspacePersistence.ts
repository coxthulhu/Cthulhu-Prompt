import type { Workspace } from '@shared/Workspace'
import * as path from 'path'
import { readPromptFolders, readWorkspaceId } from '../DataAccess/WorkspaceReads'
import { createPersistenceStageResult, type PersistenceLayer } from './PersistenceTypes'
import {
  commitStagedFileChange,
  createStagedFileRemove,
  createStagedFileUpsert,
  revertStagedFileChange,
  resolveTempPath,
  writeJsonFile,
  type FilePersistenceStagedChange
} from './FilePersistenceHelpers'

export type WorkspacePersistenceFields = {
  workspacePath: string
}

const WORKSPACE_INFO_FILENAME = 'WorkspaceInfo.json'

const resolveTargetPath = (workspacePath: string): string => {
  return path.join(workspacePath, WORKSPACE_INFO_FILENAME)
}

export const workspacePersistence: PersistenceLayer<
  Workspace,
  WorkspacePersistenceFields,
  FilePersistenceStagedChange
> = {
  stageChanges: async (change) => {
    const targetPath = resolveTargetPath(change.persistenceFields.workspacePath)

    if (change.type === 'remove') {
      return createPersistenceStageResult(createStagedFileRemove(targetPath))
    }

    const tempPath = resolveTempPath(targetPath)
    writeJsonFile(tempPath, { workspaceId: change.data.id })

    return createPersistenceStageResult(createStagedFileUpsert(targetPath, tempPath))
  },
  commitChanges: async (stagedChange) => {
    commitStagedFileChange(stagedChange)
  },
  revertChanges: async (stagedChange) => {
    revertStagedFileChange(stagedChange)
  },
  loadData: async (persistenceFields) => {
    const { workspacePath } = persistenceFields
    const workspaceId = readWorkspaceId(workspacePath)
    const promptFolders = readPromptFolders(workspacePath)

    return {
      id: workspaceId,
      workspacePath,
      promptFolderIds: promptFolders.map((promptFolder) => promptFolder.id)
    }
  }
}
