import type { PromptFolder } from '@shared/domain/prompt-folder/PromptFolder'
import type { PromptSummaryData } from '@shared/domain/prompt/Prompt'
import type { PromptTemplatePersisted } from '@shared/domain/prompt-template/PromptTemplate'
import type { RevisionEnvelope } from '@shared/ipc/Revision'
import type { IpcResult } from '@shared/ipc/IpcResult'
import type { FolderEntryRef } from '@shared/domain/OrderContainer'
import type { PromptFolderKind } from '@shared/domain/prompt-folder/PromptFolder'

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
  categories: Array<RevisionEnvelope<import('@shared/domain/category/Category').Category>>
  prompts: Array<RevisionEnvelope<PromptSummaryData>>
  promptTemplates: Array<RevisionEnvelope<PromptTemplatePersisted>>
}>
