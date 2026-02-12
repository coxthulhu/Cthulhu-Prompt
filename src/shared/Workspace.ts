import type { PromptFolder } from './PromptFolder'
import type { RevisionEnvelope } from './Revision'
import type {
  IpcResult
} from './IpcResult'

export interface Workspace {
  id: string
  workspacePath: string
  promptFolderIds: string[]
}

// Special-case create payload. This is command data for workspace setup,
// not a normal revision mutation object with entity revisions.
export type CreateWorkspacePayload = {
  workspacePath: string
  includeExamplePrompts: boolean
}

export type CloseWorkspacePayload = Record<string, never>

export type LoadWorkspaceByPathRequest = {
  workspacePath: string
}

export type LoadWorkspaceByPathResult = IpcResult<{
  workspace: RevisionEnvelope<Workspace>
  promptFolders: Array<RevisionEnvelope<PromptFolder>>
}>
