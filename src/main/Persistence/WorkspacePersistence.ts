import type { Workspace } from '@shared/domain/workspace/Workspace'
import type { CollectionEntryRef } from '@shared/domain/OrderContainer'
import type { WorkspaceCollectionOrderFile } from './workspace/WorkspaceDiskTypes'
import { readWorkspaceCollectionEntries, readWorkspaceInfo } from './workspace/WorkspaceReads'
import { createPersistenceStageResult, type PersistenceLayer } from './PersistenceTypes'
import {
  commitStagedFileChanges,
  createStagedFileRemove,
  createStagedFileUpsert,
  revertStagedFileChanges,
  resolveTempPath,
  writeJsonFile
} from './FilePersistenceHelpers'
import { resolveWorkspaceCollectionOrderPath } from './PromptPersistencePaths'
import { LATEST_WORKSPACE_SCHEMA_VERSION } from './workspace/WorkspaceMigrations'

export type WorkspacePersistenceFields = {
  workspacePath: string
  workspaceInfoPath: string
}

const toWorkspaceCollectionOrderFile = (entries: CollectionEntryRef[]): WorkspaceCollectionOrderFile => {
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
    /** Task-prompt collection order stored below the Prompts directory. */
    const promptCollectionOrderPath = resolveWorkspaceCollectionOrderPath(fields.workspacePath, 'prompt')
    /** Prompt-template collection order stored below the Templates directory. */
    const templateCollectionOrderPath = resolveWorkspaceCollectionOrderPath(
      fields.workspacePath,
      'template'
    )

    if (!after) {
      return createPersistenceStageResult([
        createStagedFileRemove(infoPath),
        createStagedFileRemove(promptCollectionOrderPath),
        createStagedFileRemove(templateCollectionOrderPath)
      ])
    }

    const infoTempPath = resolveTempPath(infoPath)
    writeJsonFile(infoTempPath, {
      schemaVersion: LATEST_WORKSPACE_SCHEMA_VERSION,
      workspaceId: after.data.id,
      workspaceName: after.data.workspaceName
    })
    /** Staged task-prompt order written atomically with the workspace record. */
    const promptCollectionOrderTempPath = resolveTempPath(promptCollectionOrderPath)
    writeJsonFile(
      promptCollectionOrderTempPath,
      toWorkspaceCollectionOrderFile(after.data.promptCollectionEntries)
    )
    /** Staged prompt-template order written atomically with the workspace record. */
    const templateCollectionOrderTempPath = resolveTempPath(templateCollectionOrderPath)
    writeJsonFile(
      templateCollectionOrderTempPath,
      toWorkspaceCollectionOrderFile(after.data.templateCollectionEntries)
    )

    return createPersistenceStageResult([
      createStagedFileUpsert(infoPath, infoTempPath),
      createStagedFileUpsert(promptCollectionOrderPath, promptCollectionOrderTempPath),
      createStagedFileUpsert(templateCollectionOrderPath, templateCollectionOrderTempPath)
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
      promptCollectionEntries: readWorkspaceCollectionEntries(workspacePath, 'prompt'),
      templateCollectionEntries: readWorkspaceCollectionEntries(workspacePath, 'template')
    }
  }
}
