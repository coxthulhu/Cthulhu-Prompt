import type { PromptCollection } from '@shared/domain/prompt-collection/PromptCollection'
import type { PromptSummaryData } from '@shared/domain/prompt/Prompt'
import type { PromptTemplatePersisted } from '@shared/domain/prompt-template/PromptTemplate'
import type { RevisionEnvelope } from '@shared/ipc/Revision'
import type { IpcResult } from '@shared/ipc/IpcResult'
import type { CollectionEntryRef } from '@shared/domain/OrderContainer'

export interface WorkspaceCollections {
  id: string
  /** Ordered task and template collections owned by this workspace's default project. */
  collectionEntries: CollectionEntryRef[]
}

export interface Workspace extends WorkspaceCollections {
  /** User-owned favorite order shared by task and template collections. */
  favoriteCollectionIds: string[]
  workspacePath: string
  workspaceName: string
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
  /** Info path actually loaded, which differs from the request after a legacy filename rename. */
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
