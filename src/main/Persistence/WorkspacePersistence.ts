import type { Workspace } from '@shared/Workspace'
import type { FolderEntryRef } from '@shared/OrderContainer'
import type { WorkspaceFolderOrderFile } from '../DiskTypes/WorkspaceDiskTypes'
import { readWorkspaceFolderEntries, readWorkspaceInfo } from '../DataAccess/WorkspaceReads'
import { createPersistenceStageResult, type PersistenceLayer } from './PersistenceTypes'
import {
  commitStagedFileChanges,
  createStagedFileRemove,
  createStagedFileUpsert,
  revertStagedFileChanges,
  resolveTempPath,
  writeJsonFile
} from './FilePersistenceHelpers'
import { resolveWorkspaceFolderOrderPath } from './PromptPersistencePaths'

export type WorkspacePersistenceFields = {
  workspacePath: string
  workspaceInfoPath: string
}

const toWorkspaceFolderOrderFile = (entries: FolderEntryRef[]): WorkspaceFolderOrderFile => {
  return { entries }
}

export const workspacePersistence: PersistenceLayer<Workspace, WorkspacePersistenceFields> = {
  stageChanges: async (change) => {
    const infoPath = change.persistenceFields.workspaceInfoPath
    const folderOrderPath = resolveWorkspaceFolderOrderPath(change.persistenceFields.workspacePath)

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
    writeJsonFile(folderOrderTempPath, toWorkspaceFolderOrderFile(change.data.entries))

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

    return {
      id: workspaceInfo.workspaceId,
      workspacePath,
      workspaceName: workspaceInfo.workspaceName,
      entries: readWorkspaceFolderEntries(workspacePath)
    }
  }
}
