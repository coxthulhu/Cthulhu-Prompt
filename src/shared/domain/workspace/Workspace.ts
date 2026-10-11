import type { PromptCollection } from '@shared/domain/prompt-collection/PromptCollection'
import type { PromptSummaryData } from '@shared/domain/prompt/Prompt'
import type { PromptTemplatePersisted } from '@shared/domain/prompt-template/PromptTemplate'
import type { RevisionEnvelope } from '@shared/ipc/Revision'
import type { IpcResult } from '@shared/ipc/IpcResult'
import type { CollectionEntryRef } from '@shared/domain/OrderContainer'
import type { PromptCollectionKind } from '@shared/domain/prompt-collection/PromptCollection'

export interface WorkspaceCollections {
  id: string
  /** Ordered task-prompt collections owned by this workspace. */
  promptCollectionEntries: CollectionEntryRef[]
  /** Ordered prompt-template collections owned by this workspace. */
  templateCollectionEntries: CollectionEntryRef[]
}

export interface Workspace extends WorkspaceCollections {
  workspacePath: string
  workspaceName: string
}

/** Returns the workspace collection order for one collection kind. */
export const getWorkspaceCollectionEntries = (
  workspace: WorkspaceCollections,
  kind: PromptCollectionKind
): CollectionEntryRef[] =>
  kind === 'template' ? workspace.templateCollectionEntries : workspace.promptCollectionEntries

/** Returns both workspace collection orders with task prompts first. */
export const getAllWorkspaceCollectionEntries = (workspace: WorkspaceCollections): CollectionEntryRef[] => [
  ...workspace.promptCollectionEntries,
  ...workspace.templateCollectionEntries
]

/** Replaces the workspace collection order for one collection kind. */
export const setWorkspaceCollectionEntries = (
  workspace: WorkspaceCollections,
  kind: PromptCollectionKind,
  entries: CollectionEntryRef[]
): void => {
  if (kind === 'template') workspace.templateCollectionEntries = entries
  else workspace.promptCollectionEntries = entries
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
  promptCollections: Array<RevisionEnvelope<PromptCollection>>
  categories: Array<RevisionEnvelope<import('@shared/domain/category/Category').Category>>
  prompts: Array<RevisionEnvelope<PromptSummaryData>>
  promptTemplates: Array<RevisionEnvelope<PromptTemplatePersisted>>
}>
