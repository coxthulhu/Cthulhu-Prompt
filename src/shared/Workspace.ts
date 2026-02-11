import type { PromptFolder } from './PromptFolder'
import type { RevisionEnvelope } from './Revision'
import type {
  MutationRequest,
  MutationWireRequest
} from './SystemSettings'

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

export type CreateWorkspaceWireRequest =
  MutationWireRequest<MutationRequest<CreateWorkspacePayload>>

export type CreateWorkspaceResponse =
  | { requestId: string; success: true }
  | { requestId: string; success: false; error: string }

export type CloseWorkspaceWireRequest = {
  requestId: string
}

export type CloseWorkspaceResult =
  | { requestId: string; success: true }
  | { requestId: string; success: false; error: string }

export type LoadWorkspaceByPathRequest = {
  workspacePath: string
}

export type LoadWorkspaceByPathWireRequest = {
  requestId: string
  payload: LoadWorkspaceByPathRequest
}

export type LoadWorkspaceByPathResult =
  | {
      success: true
      workspace: RevisionEnvelope<Workspace>
      promptFolders: Array<RevisionEnvelope<PromptFolder>>
    }
  | { success: false; error: string }
