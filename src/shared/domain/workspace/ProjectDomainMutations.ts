import type { DomainChange, DomainPlanner } from '../DomainChanges'
import { planDeletePromptCollectionDomainMutation } from '../prompt-collection/PromptCollectionDomainMutations'
import { createEmptyPromptCollectionSettings, createPromptStatusFolderLayouts, type PromptCollection } from '../prompt-collection/PromptCollection'
import { preparePromptCollectionName } from '../prompt-collection/promptCollectionName'
import { prepareProjectInfo, type Project, type ProjectInfo } from './Project'

/** Metadata replacement shared by project creation and editing. */
export type UpdateProjectCommand = { workspaceId: string; project: ProjectInfo }
/** Creation includes both starter collection identities so both processes plan identically. */
export type CreateProjectCommand = UpdateProjectCommand & { promptCollectionId: string; templateCollectionId: string }
/** Stable identity of a project owned by one workspace. */
export type DeleteProjectCommand = { workspaceId: string; projectId: string }
/** A null predecessor places a project first, matching collection ordering. */
export type MoveProjectCommand = DeleteProjectCommand & { previousProjectId: string | null }

/** Validates exact metadata shape before applying normalized domain rules. */
const isProjectInfo = (value: unknown): value is ProjectInfo => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  /** Untrusted metadata includes only the documented shared fields. */
  const record = value as Record<string, unknown>
  return typeof record.id === 'string' && typeof record.name === 'string' && typeof record.abbreviation === 'string' &&
    (record.shortDescription === undefined || typeof record.shortDescription === 'string') &&
    (record.description === undefined || typeof record.description === 'string') &&
    Object.keys(record).every((key) => ['id', 'name', 'abbreviation', 'shortDescription', 'description'].includes(key))
}

/** Parses exact metadata-edit commands at the IPC boundary. */
export const parseUpdateProjectCommand = (value: unknown): UpdateProjectCommand | null => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  /** Only workspace identity and the complete replacement metadata are accepted. */
  const record = value as Record<string, unknown>
  return Object.keys(record).length === 2 && typeof record.workspaceId === 'string' && isProjectInfo(record.project)
    ? record as UpdateProjectCommand : null
}

/** Parses creation without allowing extra properties or missing starter identities. */
export const parseCreateProjectCommand = (value: unknown): CreateProjectCommand | null => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  /** Four fields carry every nondeterministic input required by the planner. */
  const record = value as Record<string, unknown>
  return Object.keys(record).length === 4 && typeof record.workspaceId === 'string' && isProjectInfo(record.project) &&
    typeof record.promptCollectionId === 'string' && typeof record.templateCollectionId === 'string'
    ? record as CreateProjectCommand : null
}

/** Parses project deletion without accepting unrelated command fields. */
export const parseDeleteProjectCommand = (value: unknown): DeleteProjectCommand | null => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  /** Two stable identities are sufficient to delete the complete owned graph. */
  const record = value as Record<string, unknown>
  return Object.keys(record).length === 2 && typeof record.workspaceId === 'string' && typeof record.projectId === 'string'
    ? record as DeleteProjectCommand : null
}

/** Parses reordering with an explicit predecessor or first position. */
export const parseMoveProjectCommand = (value: unknown): MoveProjectCommand | null => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  /** Every move remains scoped to a single workspace. */
  const record = value as Record<string, unknown>
  return Object.keys(record).length === 3 && typeof record.workspaceId === 'string' && typeof record.projectId === 'string' &&
    (record.previousProjectId === null || typeof record.previousProjectId === 'string') ? record as MoveProjectCommand : null
}

/** Creates an empty starter collection with the same naming and status layout as ordinary collections. */
const starterCollection = (id: string, kind: 'prompt' | 'template'): PromptCollection => ({
  id, kind, displayName: kind === 'prompt' ? 'My Prompts' : 'My Templates',
  folderName: kind === 'prompt' ? 'MyPrompts' : 'MyTemplates',
  statusFolders: createPromptStatusFolderLayouts(), settings: createEmptyPromptCollectionSettings()
})

/** Creates a project and both empty starter collections in one atomic mutation. */
export const planCreateProject: DomainPlanner<CreateProjectCommand> = (state, command) => {
  /** Workspace supplies project name and abbreviation uniqueness. */
  const workspace = state.get('workspace', command.workspaceId)
  if (!workspace) throw new Error('Workspace not loaded')
  if (workspace.projects.some((project) => project.id === command.project.id) ||
    command.promptCollectionId === command.templateCollectionId ||
    state.get('promptCollection', command.promptCollectionId) || state.get('promptCollection', command.templateCollectionId)) throw new Error('Project identity already exists')
  /** Normalized metadata is shared by the optimistic and authoritative plans. */
  const info = prepareProjectInfo(command.project, workspace.projects)
  /** Project order starts with the new project; starter collections begin task-first. */
  const project: Project = { ...info, folderName: preparePromptCollectionName(info.name).folderName,
    collectionEntries: [command.promptCollectionId, command.templateCollectionId].map((id) => ({ kind: 'collection', id })), favoriteCollectionIds: [] }
  return [
    { type: 'update', entityType: 'workspace', id: workspace.id, recipe: (draft) => { draft.projects.unshift(project) } },
    { type: 'insert', entityType: 'promptCollection', id: command.promptCollectionId, data: starterCollection(command.promptCollectionId, 'prompt') },
    { type: 'insert', entityType: 'promptCollection', id: command.templateCollectionId, data: starterCollection(command.templateCollectionId, 'template') }
  ]
}

/** Replaces shared metadata and derives the directory name while preserving identity and private preferences. */
export const planUpdateProject: DomainPlanner<UpdateProjectCommand> = (state, command) => {
  /** Workspace owns the project being edited. */
  const workspace = state.get('workspace', command.workspaceId)
  if (!workspace || !workspace.projects.some((project) => project.id === command.project.id)) throw new Error('Project not found')
  /** Normalized replacement also validates conflicts against sibling projects. */
  const info = prepareProjectInfo(command.project, workspace.projects)
  return [{ type: 'update', entityType: 'workspace', id: workspace.id, recipe: (draft) => {
    /** Replace optional descriptions as well as the required fields. */
    const project = draft.projects.find((candidate) => candidate.id === info.id)!
    delete project.shortDescription
    delete project.description
    Object.assign(project, info, { folderName: preparePromptCollectionName(info.name).folderName })
  } }]
}

/** Reorders projects without changing their individual collection preferences. */
export const planMoveProject: DomainPlanner<MoveProjectCommand> = (state, command) => {
  /** Workspace order is the sole authoritative target. */
  const workspace = state.get('workspace', command.workspaceId)
  /** Moved project is removed before resolving the predecessor. */
  const project = workspace?.projects.find((candidate) => candidate.id === command.projectId)
  if (!workspace || !project) throw new Error('Project not found')
  /** Remaining ordered projects keep their relative positions. */
  const projects = workspace.projects.filter((candidate) => candidate.id !== project.id)
  /** Null places the project first; unknown predecessors are rejected. */
  const index = command.previousProjectId === null ? 0 : projects.findIndex((candidate) => candidate.id === command.previousProjectId) + 1
  if (command.previousProjectId !== null && index === 0) throw new Error('Previous project not found')
  projects.splice(index, 0, project)
  return [{ type: 'update', entityType: 'workspace', id: workspace.id, recipe: (draft) => { draft.projects = projects } }]
}

/** Deletes every owned entity and preference, then persists Home even when other projects remain. */
export const planDeleteProject: DomainPlanner<DeleteProjectCommand> = (state, command) => {
  /** Workspace identity survives deletion of its final project. */
  const workspace = state.get('workspace', command.workspaceId)
  /** Project graph to remove atomically. */
  const project = workspace?.projects.find((candidate) => candidate.id === command.projectId)
  if (!workspace || !project) throw new Error('Project not found')
  /** Reuse collection cleanup while replacing its workspace and navigation updates with one project-level update. */
  const changes: DomainChange[] = []
  for (const entry of project.collectionEntries) {
    /** Existing deletion planner covers notes, categories, editors, and optional UI state. */
    const plan = planDeletePromptCollectionDomainMutation(state, { workspaceId: workspace.id, promptCollectionId: entry.id })
    if (!Array.isArray(plan)) return plan
    changes.push(...plan.filter((change) => change.entityType !== 'workspace' && change.entityType !== 'workspaceUiState'))
  }
  changes.push({ type: 'update', entityType: 'workspace', id: workspace.id, recipe: (draft) => {
    draft.projects = draft.projects.filter((candidate) => candidate.id !== project.id)
  } })
  if (state.get('workspaceUiState', workspace.id)) changes.push({ type: 'update', entityType: 'workspaceUiState', id: workspace.id, recipe: (draft) => {
    draft.selectedScreen = 'home'
    draft.selectedScreenData = null
    delete draft.lastCollectionIdByProject[project.id]
  } })
  return changes
}
