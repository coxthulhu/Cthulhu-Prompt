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
  kind: 'filesystem',
  stageChanges: async (transition) => {
    /** Current workspace record used for deletion paths. */
    const before = transition.before
    /** Desired workspace record used for written paths and data. */
    const after = transition.after
    if (!before && !after) throw new Error('Workspace persistence transition is empty')
    /** Persistence metadata selected from the present transition side. */
    const fields = (after ?? before)!.persistenceFields
    const infoPath = fields.workspaceInfoPath
    const folderOrderPath = resolveWorkspaceFolderOrderPath(fields.workspacePath)

    if (!after) {
      return createPersistenceStageResult([
        createStagedFileRemove(infoPath),
        createStagedFileRemove(folderOrderPath)
      ])
    }

    const infoTempPath = resolveTempPath(infoPath)
    writeJsonFile(infoTempPath, {
      workspaceId: after.data.id,
      workspaceName: after.data.workspaceName
    })
    const folderOrderTempPath = resolveTempPath(folderOrderPath)
    writeJsonFile(folderOrderTempPath, toWorkspaceFolderOrderFile(after.data.entries))

    return createPersistenceStageResult([
      createStagedFileUpsert(infoPath, infoTempPath),
      createStagedFileUpsert(folderOrderPath, folderOrderTempPath)
    ])
  },
  commitChanges: (stagedChange) => {
    commitStagedFileChanges(stagedChange)
  },
  revertChanges: (stagedChange) => {
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
