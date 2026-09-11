import type { PromptFolder } from './PromptFolder'
import type { PromptSummaryData } from './Prompt'
import type { PromptTemplatePersisted } from './PromptTemplate'
import type { RevisionEnvelope } from './Revision'
import type { IpcResult } from './IpcResult'
import type { FolderEntryRef } from './OrderContainer'
import type { PromptFolderKind } from './PromptFolder'

export interface WorkspaceRoot {
  id: string
  /** Ordered task-prompt root folders owned by this workspace. */
  promptFolderEntries: FolderEntryRef[]
  /** Ordered prompt-template root folders owned by this workspace. */
  templateFolderEntries: FolderEntryRef[]
}

export interface Workspace extends WorkspaceRoot {
  workspacePath: string
  workspaceName: string
}

/** Returns the workspace root-folder order for one folder kind. */
export const getWorkspaceFolderEntries = (
  workspace: WorkspaceRoot,
  kind: PromptFolderKind
): FolderEntryRef[] =>
  kind === 'template' ? workspace.templateFolderEntries : workspace.promptFolderEntries

/** Returns both workspace root-folder orders with task prompts first. */
export const getAllWorkspaceFolderEntries = (workspace: WorkspaceRoot): FolderEntryRef[] => [
  ...workspace.promptFolderEntries,
  ...workspace.templateFolderEntries
]

/** Replaces the workspace root-folder order for one folder kind. */
export const setWorkspaceFolderEntries = (
  workspace: WorkspaceRoot,
  kind: PromptFolderKind,
  entries: FolderEntryRef[]
): void => {
  if (kind === 'template') workspace.templateFolderEntries = entries
  else workspace.promptFolderEntries = entries
}

// Special-case create payload. This is command data for workspace setup,
// not a normal revision mutation object with entity revisions.
export type CreateWorkspacePayload = {
  workspacePath: string
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
  workspace: RevisionEnvelope<Workspace>
  promptFolders: Array<RevisionEnvelope<PromptFolder>>
  categories: Array<RevisionEnvelope<import('./Category').Category>>
  prompts: Array<RevisionEnvelope<PromptSummaryData>>
  promptTemplates: Array<RevisionEnvelope<PromptTemplatePersisted>>
}>
