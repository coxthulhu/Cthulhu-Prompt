import type { PromptFolder } from './PromptFolder'
import type { PromptSummaryData } from './Prompt'
import type { PromptTemplateSummaryData } from './PromptTemplate'
import type { RevisionEnvelope, RevisionPayloadEntity } from './Revision'
import type { IpcResult } from './IpcResult'
import type { FolderEntryRef, OrderContainer } from './OrderContainer'

export interface WorkspaceRoot extends OrderContainer<FolderEntryRef> {
  id: string
}

export interface Workspace extends WorkspaceRoot {
  workspacePath: string
  workspaceName: string
}

export type MovePromptFolderPayload = {
  workspace: RevisionPayloadEntity<Workspace>
  sourceParentPromptFolder: RevisionPayloadEntity<PromptFolder> | null
  destinationParentPromptFolder: RevisionPayloadEntity<PromptFolder> | null
  promptFolderId: string
  previousEntryId: string | null
}

export type MovePromptFolderResponsePayload = {
  workspace: RevisionEnvelope<Workspace>
  promptFolders: Array<RevisionEnvelope<PromptFolder>>
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
  prompts: Array<RevisionEnvelope<PromptSummaryData>>
  promptTemplates: Array<RevisionEnvelope<PromptTemplateSummaryData>>
}>
