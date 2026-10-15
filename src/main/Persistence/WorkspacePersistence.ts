import type { Workspace } from '@shared/domain/workspace/Workspace'
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
import { WorkspaceStateDataAccess } from './sqlite/WorkspaceStateDataAccess'
import { SqliteDataAccess } from './sqlite/SqliteDataAccess'
import { LATEST_WORKSPACE_SCHEMA_VERSION } from './workspace/WorkspaceMigrations'

/** Filesystem location of the shared workspace identity and content. */
export type WorkspacePersistenceFields = {
  workspacePath: string
  workspaceInfoPath: string
}

/** Persists shared workspace metadata and user-specific SQLite collection orders atomically. */
export const workspacePersistence: PersistenceLayer<Workspace, WorkspacePersistenceFields> = {
  kind: 'filesystem',
  command: (workspaceId, transition) => {
    for (const kind of ['prompt', 'template'] as const) {
      if (!transition.after) {
        WorkspaceStateDataAccess.delete(workspaceId, `${kind}-collection-order`, null)
        continue
      }
      /** The workspace owns independent orders for each collection kind. */
      const entries = kind === 'prompt'
        ? transition.after.data.promptCollectionEntries
        : transition.after.data.templateCollectionEntries
      WorkspaceStateDataAccess.write(workspaceId, `${kind}-collection-order`, null, { entries })
    }
  },
  stageChanges: async (transition) => {
    /** Current workspace record used for deletion paths. */
    const before = transition.before
    /** Desired workspace record used for written paths and data. */
    const after = transition.after
    if (!before && !after) throw new Error('Workspace persistence transition is empty')
    /** Persistence metadata selected from the present transition side. */
    const fields = (after ?? before)!.persistenceFields
    /** Shared identity file remains on disk. */
    const infoPath = fields.workspaceInfoPath
    if (!after) return createPersistenceStageResult([createStagedFileRemove(infoPath)])

    // Collection ordering alone does not change shared workspace metadata.
    if (before && before.data.workspaceName === after.data.workspaceName && before.data.id === after.data.id) {
      return createPersistenceStageResult([])
    }

    /** Staged identity file committed alongside the SQLite order. */
    const infoTempPath = resolveTempPath(infoPath)
    writeJsonFile(infoTempPath, {
      schemaVersion: LATEST_WORKSPACE_SCHEMA_VERSION,
      workspaceId: after.data.id,
      workspaceName: after.data.workspaceName
    })
    return createPersistenceStageResult([createStagedFileUpsert(infoPath, infoTempPath)])
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

    // Initialize or repair both orders together before publishing the workspace snapshot.
    return SqliteDataAccess.runTransaction(() => ({
      id: workspaceInfo.workspaceId,
      workspacePath,
      workspaceName: workspaceInfo.workspaceName,
      promptCollectionEntries: readWorkspaceCollectionEntries(workspacePath, workspaceInfo.workspaceId, 'prompt'),
      templateCollectionEntries: readWorkspaceCollectionEntries(workspacePath, workspaceInfo.workspaceId, 'template')
    }))
  }
}
