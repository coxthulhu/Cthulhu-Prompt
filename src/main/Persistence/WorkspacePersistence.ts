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
import { LATEST_WORKSPACE_SCHEMA_VERSION } from './WorkspaceMigrations'

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
    /** Task-prompt root order stored below the Prompts directory. */
    const promptFolderOrderPath = resolveWorkspaceFolderOrderPath(fields.workspacePath, 'prompt')
    /** Prompt-template root order stored below the Templates directory. */
    const templateFolderOrderPath = resolveWorkspaceFolderOrderPath(
      fields.workspacePath,
      'template'
    )

    if (!after) {
      return createPersistenceStageResult([
        createStagedFileRemove(infoPath),
        createStagedFileRemove(promptFolderOrderPath),
        createStagedFileRemove(templateFolderOrderPath)
      ])
    }

    const infoTempPath = resolveTempPath(infoPath)
    writeJsonFile(infoTempPath, {
      schemaVersion: LATEST_WORKSPACE_SCHEMA_VERSION,
      workspaceId: after.data.id,
      workspaceName: after.data.workspaceName
    })
    /** Staged task-prompt order written atomically with the workspace record. */
    const promptFolderOrderTempPath = resolveTempPath(promptFolderOrderPath)
    writeJsonFile(
      promptFolderOrderTempPath,
      toWorkspaceFolderOrderFile(after.data.promptFolderEntries)
    )
    /** Staged prompt-template order written atomically with the workspace record. */
    const templateFolderOrderTempPath = resolveTempPath(templateFolderOrderPath)
    writeJsonFile(
      templateFolderOrderTempPath,
      toWorkspaceFolderOrderFile(after.data.templateFolderEntries)
    )

    return createPersistenceStageResult([
      createStagedFileUpsert(infoPath, infoTempPath),
      createStagedFileUpsert(promptFolderOrderPath, promptFolderOrderTempPath),
      createStagedFileUpsert(templateFolderOrderPath, templateFolderOrderTempPath)
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
      promptFolderEntries: readWorkspaceFolderEntries(workspacePath, 'prompt'),
      templateFolderEntries: readWorkspaceFolderEntries(workspacePath, 'template')
    }
  }
}
