import * as path from 'path'
import type { Workspace } from '@shared/domain/workspace/Workspace'
import { readWorkspaceInfo } from './workspace/WorkspaceReads'
import { readWorkspaceProjects, PROJECT_INFO_FILENAME, serializeProjectInfo } from './workspace/ProjectReads'
import { createPersistenceStageResult, type PersistenceLayer } from './PersistenceTypes'
import {
  commitStagedFileChanges, createStagedDirectoryRemove, createStagedDirectoryRename,
  createStagedEnsureDirectory, createStagedFileRemove, createStagedFileUpsert,
  revertStagedFileChanges, resolveTempPath, writeJsonFile, type FilePersistenceStagedChange
} from './FilePersistenceHelpers'
import { getFs } from '../fs-provider'
import { WorkspaceStateDataAccess } from './sqlite/WorkspaceStateDataAccess'
import { SqliteDataAccess } from './sqlite/SqliteDataAccess'
import { LATEST_WORKSPACE_SCHEMA_VERSION } from './workspace/WorkspaceMigrations'

/** Filesystem location of the shared workspace identity and content. */
export type WorkspacePersistenceFields = {
  workspacePath: string
  workspaceInfoPath: string
}

/** Persists project metadata and private orders atomically with their owned content. */
export const workspacePersistence: PersistenceLayer<Workspace, WorkspacePersistenceFields> = {
  kind: 'filesystem',
  command: (workspaceId, transition) => {
    /** Deleted projects lose only their own private collection preferences. */
    const projects = transition.after?.data.projects ?? []
    for (const project of transition.before?.data.projects ?? []) {
      if (projects.some((candidate) => candidate.id === project.id)) continue
      WorkspaceStateDataAccess.delete(workspaceId, 'collection-order', project.id)
      WorkspaceStateDataAccess.delete(workspaceId, 'collection-favorites', project.id)
    }
    if (!transition.after) {
      WorkspaceStateDataAccess.delete(workspaceId, 'project-order', null)
      return
    }
    WorkspaceStateDataAccess.write(workspaceId, 'project-order', null, { ids: projects.map((project) => project.id) })
    for (const project of projects) {
      WorkspaceStateDataAccess.write(workspaceId, 'collection-order', project.id, { entries: project.collectionEntries })
      WorkspaceStateDataAccess.write(workspaceId, 'collection-favorites', project.id, { ids: project.favoriteCollectionIds })
    }
  },
  stageChanges: async ({ before, after }) => {
    /** Shared identity path stays at the workspace root even when no projects remain. */
    const fields = (after ?? before)!.persistenceFields
    if (!after) return createPersistenceStageResult([createStagedFileRemove(fields.workspaceInfoPath)])
    /** Staged parent operations precede child writes during the atomic commit. */
    const changes: FilePersistenceStagedChange[] = []
    /** Moving every renamed source aside first permits cycles and case-only renames. */
    const renames: { source: string; temporary: string; target: string }[] = []
    /** Filesystem used to stage only changed shared metadata. */
    const fs = getFs()
    try {
      if (!before || before.data.workspaceName !== after.data.workspaceName) {
        /** Workspace metadata changes independently of private project order. */
        const temp = resolveTempPath(fields.workspaceInfoPath)
        writeJsonFile(temp, { schemaVersion: LATEST_WORKSPACE_SCHEMA_VERSION, workspaceId: after.data.id, workspaceName: after.data.workspaceName })
        changes.push(createStagedFileUpsert(fields.workspaceInfoPath, temp))
      }
      for (const project of before?.data.projects ?? []) {
        if (!after.data.projects.some((candidate) => candidate.id === project.id)) {
          changes.push(createStagedDirectoryRemove(path.join(fields.workspacePath, project.folderName)))
        }
      }
      for (const project of after.data.projects) {
        /** Existing metadata determines whether this is creation, editing, or a rename. */
        const previous = before?.data.projects.find((candidate) => candidate.id === project.id)
        /** Stage inside the original directory so one rename moves all content intact. */
        const source = previous ? path.join(fields.workspacePath, previous.folderName)
          : resolveTempPath(path.join(fields.workspacePath, project.folderName))
        /** New directory derived from the validated name. */
        const target = path.join(fields.workspacePath, project.folderName)
        if (fs.existsSync(target) && !before?.data.projects.some((existing) =>
          existing.folderName.toLowerCase() === project.folderName.toLowerCase())) {
          throw new Error(`Project directory already exists: ${target}`)
        }
        if (!previous) {
          fs.mkdirSync(source)
          changes.push(createStagedEnsureDirectory(source, true))
          for (const name of ['Prompts', 'Templates']) {
            fs.mkdirSync(path.join(source, name))
            changes.push(createStagedEnsureDirectory(path.join(source, name), true))
          }
        }
        if (!previous || serializeProjectInfo(previous) !== serializeProjectInfo(project)) {
          /** Only public fields are written; favorites and order never enter this file. */
          const infoPath = path.join(source, PROJECT_INFO_FILENAME)
          /** Temporary metadata participates in the same rollback as every child write. */
          const temp = resolveTempPath(infoPath)
          fs.writeFileSync(temp, serializeProjectInfo(project), 'utf8')
          changes.push(createStagedFileUpsert(infoPath, temp))
        }
        if (!previous) changes.push({ type: 'publishDirectory', sourcePath: source, targetPath: target })
        else if (source !== target) renames.push({ source, temporary: resolveTempPath(source), target })
      }
      changes.push(...renames.map(({ source, temporary }) => createStagedDirectoryRename(source, temporary)))
      changes.push(...renames.map(({ temporary, target }) => createStagedDirectoryRename(temporary, target)))
      return createPersistenceStageResult(changes)
    } catch (error) {
      revertStagedFileChanges(changes)
      throw error
    }
  },
  commitChanges: commitStagedFileChanges,
  revertChanges: revertStagedFileChanges,
  loadData: async ({ workspacePath, workspaceInfoPath }) => {
    /** Shared identity selects this user's independent project preferences. */
    const info = readWorkspaceInfo(workspaceInfoPath)
    return SqliteDataAccess.runTransaction(() => ({
      id: info.workspaceId, workspaceName: info.workspaceName, workspacePath,
      projects: readWorkspaceProjects(workspacePath, info.workspaceId)
    }))
  }
}
