import type { PromptFolder } from './PromptFolder'
import type { RevisionEnvelope } from './Revision'
import type {
  IpcMutationResponseContext,
  IpcRequestContext,
  IpcRequestWithPayload
} from './IpcRequest'

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

export type CreateWorkspaceWireRequest = IpcRequestWithPayload<CreateWorkspacePayload>

export type CreateWorkspaceResponse =
  | (IpcMutationResponseContext & { success: true })
  | (IpcMutationResponseContext & { success: false; error: string })

export type CloseWorkspaceWireRequest = IpcRequestContext

export type CloseWorkspaceResult =
  | (IpcMutationResponseContext & { success: true })
  | (IpcMutationResponseContext & { success: false; error: string })

export type LoadWorkspaceByPathRequest = {
  workspacePath: string
}

export type LoadWorkspaceByPathWireRequest =
  IpcRequestWithPayload<LoadWorkspaceByPathRequest>

export type LoadWorkspaceByPathResult =
  | {
      success: true
      workspace: RevisionEnvelope<Workspace>
      promptFolders: Array<RevisionEnvelope<PromptFolder>>
    }
  | { success: false; error: string }
