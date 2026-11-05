import * as path from 'path'
import { getProjectInfo, prepareProjectInfo, type Project, type ProjectInfo } from '@shared/domain/workspace/Project'
import { getFs } from '../../fs-provider'
import { readJsonFile } from '../FilePersistenceHelpers'
import { WorkspaceStateDataAccess } from '../sqlite/WorkspaceStateDataAccess'
import { readWorkspaceCollectionEntries } from './WorkspaceReads'

/** Identity file marking an immediate workspace directory as a project. */
export const PROJECT_INFO_FILENAME = 'ProjectInfo.json'

/** Validates project metadata before allowing it into the authoritative workspace. */
export const readProjectInfo = (projectPath: string): ProjectInfo => {
  /** Untrusted disk metadata checked independently of mutation commands. */
  const value = readJsonFile<unknown>(path.join(projectPath, PROJECT_INFO_FILENAME))
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid project metadata')
  /** Only shared metadata belongs in ProjectInfo.json. */
  const record = value as Record<string, unknown>
  if (typeof record.id !== 'string' || !record.id || typeof record.name !== 'string' ||
    typeof record.abbreviation !== 'string' || Object.keys(record).some((key) =>
      !['id', 'name', 'abbreviation', 'shortDescription', 'description'].includes(key)) ||
    (record.shortDescription !== undefined && typeof record.shortDescription !== 'string') ||
    (record.description !== undefined && typeof record.description !== 'string')) throw new Error('Invalid project metadata')
  return prepareProjectInfo(record as ProjectInfo, [])
}

/** Discovers projects, imports legacy user preferences, and repairs each independent order. */
export const readWorkspaceProjects = (workspacePath: string, workspaceId: string): Project[] => {
  /** Current disk projects in the same alphabetical folder order used by collections. */
  const projects: Project[] = []
  for (const directory of getFs().readdirSync(workspacePath, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && getFs().existsSync(path.join(workspacePath, entry.name, PROJECT_INFO_FILENAME)))
    .sort((left, right) => left.name.toLowerCase().localeCompare(right.name.toLowerCase()))) {
    /** Physical directory remains authoritative for discovering manually moved projects. */
    const projectPath = path.join(workspacePath, directory.name)
    /** Shared identity and private order are loaded independently. */
    const info = prepareProjectInfo(readProjectInfo(projectPath), projects)
    if (projects.some((project) => project.id === info.id)) throw new Error('Duplicate project ID')
    projects.push({ ...info, folderName: directory.name, collectionEntries: [], favoriteCollectionIds: [] })
  }
  /** Legacy preferences remain until all replacement rows have been committed by the caller's transaction. */
  const legacyOrder = WorkspaceStateDataAccess.read(workspaceId, 'collection-order', null)
  /** Favorites from the formerly implicit project are distributed only to their actual owners. */
  const legacyFavorites = WorkspaceStateDataAccess.read(workspaceId, 'collection-favorites', null)
  for (const project of projects) {
    project.collectionEntries = readWorkspaceCollectionEntries(path.join(workspacePath, project.folderName), workspaceId, project.id, legacyOrder?.entries)
    /** Existing memberships alone survive pruning; discoveries are never automatically starred. */
    const remaining = new Set(project.collectionEntries.map((entry) => entry.id))
    /** An existing project preference takes precedence over a legacy import. */
    const favorites = WorkspaceStateDataAccess.read(workspaceId, 'collection-favorites', project.id) ?? legacyFavorites
    project.favoriteCollectionIds = (favorites?.ids ?? []).filter((id) => remaining.delete(id))
    WorkspaceStateDataAccess.write(workspaceId, 'collection-favorites', project.id, { ids: project.favoriteCollectionIds })
  }
  WorkspaceStateDataAccess.delete(workspaceId, 'collection-order', null)
  WorkspaceStateDataAccess.delete(workspaceId, 'collection-favorites', null)
  /** Saved project positions are retained; newly discovered directories append alphabetically. */
  const saved = WorkspaceStateDataAccess.read(workspaceId, 'project-order', null)
  /** Remaining projects exclude stale and duplicate saved identities. */
  const remaining = new Map(projects.map((project) => [project.id, project]))
  /** Complete repaired order published with the workspace snapshot. */
  const ordered = (saved?.ids ?? []).flatMap((id) => {
    /** Consume each valid saved identity once. */
    const project = remaining.get(id)
    remaining.delete(id)
    return project ? [project] : []
  })
  ordered.push(...remaining.values())
  WorkspaceStateDataAccess.write(workspaceId, 'project-order', null, { ids: ordered.map((project) => project.id) })
  for (const stateType of ['collection-order', 'collection-favorites'] as const) {
    for (const id of WorkspaceStateDataAccess.listEntityIds(workspaceId, stateType)) {
      if (!projects.some((project) => project.id === id)) WorkspaceStateDataAccess.delete(workspaceId, stateType, id)
    }
  }
  return ordered
}

/** Serializes project metadata with stable field order for unchanged-file comparisons. */
export const serializeProjectInfo = (project: Project): string => JSON.stringify(getProjectInfo(project), null, 2)
