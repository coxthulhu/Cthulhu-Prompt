import type { PromptCollection } from '@shared/domain/prompt-collection/PromptCollection'
import type { PromptSummaryData } from '@shared/domain/prompt/Prompt'
import type { PromptTemplatePersisted } from '@shared/domain/prompt-template/PromptTemplate'
import type { RevisionEnvelope } from '@shared/ipc/Revision'
import type { IpcResult } from '@shared/ipc/IpcResult'
import type { Project } from './Project'
import { preparePromptCollectionName } from '../prompt-collection/promptCollectionName'

export interface WorkspaceCollections {
  id: string
  /** Projects in this user's persisted order. */
  projects: Project[]
}

export interface Workspace extends WorkspaceCollections {
  workspacePath: string
  workspaceName: string
}

/** A workspace displayed by the Open dialog. */
export type WorkspaceListEntry = { id: string; name: string; path: string }

/** Uses the same filename, validation and uniqueness rules in the dialog and on disk. */
export const prepareWorkspaceName = (input: string, catalog: WorkspaceListEntry[]) => {
  /** Existing workspace names follow the prompt collection naming rules. */
  const { displayName, folderName, validation } = preparePromptCollectionName(input)
  /** Spaces and casing do not distinguish two managed workspace filenames. */
  const duplicate = catalog.some((entry) =>
    preparePromptCollectionName(entry.name).folderName.toLowerCase() === folderName.toLowerCase()
  )
  /** Preserve the validation message for invalid names before reporting a collision. */
  const error = validation.isValid
    ? duplicate ? 'A workspace with this name already exists' : null
    : validation.errorMessage!.replace('Collection name', 'Workspace name')
  return { displayName, folderName, error }
}

/** Command data for creating and seeding a new workspace. */
export type CreateWorkspacePayload = {
  workspaceName: string
  includeExamplePrompts: boolean
}

export type CloseWorkspacePayload = Record<string, never>

export type LoadWorkspaceByPathRequest = {
  workspaceInfoPath: string
}

export type WorkspaceFolderStatus = {
  exists: boolean
  isWorkspace: boolean
  isEmpty: boolean
}

export type LoadWorkspaceByPathResult = IpcResult<{
  /** Managed database filename to remember after opening or migrating the workspace. */
  workspaceInfoPath: string
  workspace: RevisionEnvelope<Workspace>
  promptCollections: Array<RevisionEnvelope<PromptCollection>>
  categories: Array<RevisionEnvelope<import('@shared/domain/category/Category').Category>>
  prompts: Array<RevisionEnvelope<PromptSummaryData>>
  /** Full notes available independently of owner editor hydration. */
  notes: Array<RevisionEnvelope<import('@shared/domain/note/Note').Note>>
  /** User visibility preferences loaded alongside attached notes. */
  attachedNoteUiStates: Array<RevisionEnvelope<import('@shared/domain/ui-state/AttachedNoteUiState').AttachedNoteUiState>>
  promptTemplates: Array<RevisionEnvelope<PromptTemplatePersisted>>
}>
