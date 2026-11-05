import type { DomainChange, DomainPlanner } from '../DomainChanges'
import { planDeletePromptCollectionDomainMutation } from '../prompt-collection/PromptCollectionDomainMutations'
import { createEmptyPromptCollectionSettings, createPromptStatusFolderLayouts, type PromptCollection } from '../prompt-collection/PromptCollection'
import { preparePromptCollectionName } from '../prompt-collection/promptCollectionName'
import { prepareProjectInfo, type Project, type ProjectInfo } from './Project'

/** New projects carry stable starter identities generated before dispatch. */
export type SaveProjectValue = {
  project: ProjectInfo
  starterCollections: { promptCollectionId: string; templateCollectionId: string } | null
}

/** Complete retained project list, in the order requested by the management dialog. */
export type SaveProjectsCommand = { workspaceId: string; projects: SaveProjectValue[] }

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

/** Rejects malformed or additional fields throughout the complete project command. */
export const parseSaveProjectsCommand = (value: unknown): SaveProjectsCommand | null => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  /** Only workspace identity and retained values belong on the wire. */
  const record = value as Record<string, unknown>
  if (Object.keys(record).length !== 2 || typeof record.workspaceId !== 'string' || !Array.isArray(record.projects)) return null
  for (const value of record.projects) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null
    if (Object.keys(value).length !== 2 || !isProjectInfo(value.project)) return null
    /** Existing projects must explicitly omit starter creation with null. */
    const starters = value.starterCollections
    if (starters !== null && (!starters || typeof starters !== 'object' || Array.isArray(starters) ||
      Object.keys(starters).length !== 2 || typeof starters.promptCollectionId !== 'string' || typeof starters.templateCollectionId !== 'string')) return null
  }
  return record as SaveProjectsCommand
}

/** Creates an empty starter collection with the same naming and status layout as ordinary collections. */
const starterCollection = (id: string, kind: 'prompt' | 'template'): PromptCollection => ({
  id, kind, displayName: kind === 'prompt' ? 'My Prompts' : 'My Templates',
  folderName: kind === 'prompt' ? 'MyPrompts' : 'MyTemplates',
  statusFolders: createPromptStatusFolderLayouts(), settings: createEmptyPromptCollectionSettings()
})

/** Plans creation, editing, ordering, and complete owned-graph deletion as one transaction. */
export const planSaveProjects: DomainPlanner<SaveProjectsCommand> = (state, command) => {
  /** Workspace supplies existing ownership and user preferences. */
  const workspace = state.get('workspace', command.workspaceId)
  if (!workspace) throw new Error('Workspace not loaded')
  /** Requested identities distinguish retained projects from deletions. */
  const retainedIds = new Set(command.projects.map(({ project }) => project.id))
  if (retainedIds.size !== command.projects.length) throw new Error('Duplicate project identity')
  /** All retained values are normalized before checking final-set uniqueness. */
  const infos = command.projects.map(({ project }) => prepareProjectInfo(project, []))
  for (const info of infos) prepareProjectInfo(info, infos)
  /** Starter IDs must be unique across every new project and existing collection. */
  const starterIds = new Set<string>()
  /** Final ordered graph preserves the private preferences of retained projects. */
  const projects: Project[] = []
  /** Each authoritative entity receives at most one change. */
  const changes: DomainChange[] = []
  for (const [index, { starterCollections }] of command.projects.entries()) {
    /** Normalized public metadata replaces optional descriptions too. */
    const info = infos[index]
    /** Existing identity determines whether starter creation is permitted. */
    const existing = workspace.projects.find((project) => project.id === info.id)
    if (existing ? starterCollections !== null : starterCollections === null) throw new Error('Project creation identity mismatch')
    /** Retained collections and favorites never come from the dialog. */
    const project: Project = { ...info, folderName: preparePromptCollectionName(info.name).folderName,
      collectionEntries: existing?.collectionEntries ?? [], favoriteCollectionIds: existing?.favoriteCollectionIds ?? [] }
    if (starterCollections) {
      for (const [id, kind] of [[starterCollections.promptCollectionId, 'prompt'], [starterCollections.templateCollectionId, 'template']] as const) {
        if (starterIds.has(id) || state.get('promptCollection', id)) throw new Error('Starter collection identity already exists')
        starterIds.add(id)
        project.collectionEntries.push({ kind: 'collection', id })
        changes.push({ type: 'insert', entityType: 'promptCollection', id, data: starterCollection(id, kind) })
      }
    }
    projects.push(project)
  }
  /** Omitted projects lose their content and preferences atomically. */
  const deletedProjects = workspace.projects.filter((project) => !retainedIds.has(project.id))
  for (const project of deletedProjects) {
    for (const entry of project.collectionEntries) {
      /** Existing collection cleanup covers notes, categories, editors, and optional UI state. */
      const plan = planDeletePromptCollectionDomainMutation(state, { workspaceId: workspace.id, promptCollectionId: entry.id })
      if (!Array.isArray(plan)) return plan
      changes.push(...plan.filter((change) => change.entityType !== 'workspace' && change.entityType !== 'workspaceUiState'))
    }
  }
  changes.push({ type: 'update', entityType: 'workspace', id: workspace.id, recipe: (draft) => { draft.projects = projects } })
  if (deletedProjects.length && state.get('workspaceUiState', workspace.id)) {
    changes.push({ type: 'update', entityType: 'workspaceUiState', id: workspace.id, recipe: (draft) => {
      if (draft.selectedScreen === 'project' && !retainedIds.has(draft.selectedScreenData.projectId)) {
        Object.assign(draft, { selectedScreen: 'home', selectedScreenData: null })
      }
      for (const project of deletedProjects) delete draft.lastCollectionIdByProject[project.id]
    } })
  }
  return changes
}
