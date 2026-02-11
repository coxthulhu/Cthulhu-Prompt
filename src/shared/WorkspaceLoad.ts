import type { PromptFolder } from './PromptFolder'
import type { RevisionEnvelope } from './Revision'
import type { Workspace } from './Workspace'

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
