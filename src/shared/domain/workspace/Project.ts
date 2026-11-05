import type { CollectionEntryRef } from '@shared/domain/OrderContainer'
import { preparePromptCollectionName } from '@shared/domain/prompt-collection/promptCollectionName'
import type { Workspace } from './Workspace'

/** Shared project metadata stored in ProjectInfo.json. */
export type ProjectInfo = {
  /** Stable compact GUID independent of the directory name. */
  id: string
  /** Required workspace-unique display name. */
  name: string
  /** Required workspace-unique pair of uppercase letters or digits. */
  abbreviation: string
  /** Optional summary shown by future project management views. */
  shortDescription?: string
  /** Optional complete project description. */
  description?: string
}

/** Project metadata and user-owned collection preferences in the workspace snapshot. */
export type Project = ProjectInfo & {
  /** Actual directory discovered on disk or derived when creating and renaming. */
  folderName: string
  /** Combined order of task and template collections. */
  collectionEntries: CollectionEntryRef[]
  /** Independent ordered favorites belonging to this user. */
  favoriteCollectionIds: string[]
}

/** Default project's initial display name; it has no special identity after creation. */
export const DEFAULT_PROJECT_NAME = 'Default Project'
/** Initial abbreviation, available for reuse after this project is deleted or edited. */
export const DEFAULT_PROJECT_ABBREVIATION = 'DE'

/** Flattens collection references for workspace-wide content and template operations. */
export const getWorkspaceCollectionEntries = (workspace: Workspace): CollectionEntryRef[] =>
  workspace.projects.flatMap((project) => project.collectionEntries)

/** Resolves a collection's owning project using its stable identity. */
export const findCollectionProject = (workspace: Workspace, collectionId: string): Project | undefined =>
  workspace.projects.find((project) => project.collectionEntries.some((entry) => entry.id === collectionId))

/** Validates names against the existing collection directory rules and normalizes abbreviations. */
export const prepareProjectInfo = (info: ProjectInfo, siblings: readonly Project[]): ProjectInfo => {
  /** Shared naming policy strips whitespace from the directory name and ignores casing for conflicts. */
  const prepared = preparePromptCollectionName(info.name)
  if (!prepared.validation.isValid) throw new Error(prepared.validation.errorMessage!.replaceAll('Collection', 'Project').replaceAll('collection', 'project'))
  /** Canonical abbreviation used for both storage and uniqueness checks. */
  const abbreviation = info.abbreviation.trim().toUpperCase()
  if (!/^[A-Z0-9]{2}$/.test(abbreviation)) throw new Error('Project abbreviation must contain exactly two letters or digits')
  if (siblings.some((project) => project.id !== info.id &&
    preparePromptCollectionName(project.name).folderName.toLowerCase() === prepared.folderName.toLowerCase())) {
    throw new Error('A project with this name already exists')
  }
  if (siblings.some((project) => project.id !== info.id && project.abbreviation.toUpperCase() === abbreviation)) {
    throw new Error('A project with this abbreviation already exists')
  }
  return { ...info, name: prepared.displayName, abbreviation }
}

/** Extracts shared metadata without leaking private collection ordering into workspace files. */
export const getProjectInfo = (project: Project): ProjectInfo => ({
  id: project.id, name: project.name, abbreviation: project.abbreviation,
  ...(project.shortDescription !== undefined ? { shortDescription: project.shortDescription } : {}),
  ...(project.description !== undefined ? { description: project.description } : {})
})
