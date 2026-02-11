import type { TanstackPromptFolder } from './TanstackPromptFolder'
import type { TanstackRevisionEnvelope } from './TanstackRevision'
import type { TanstackWorkspace } from './TanstackWorkspace'

export type TanstackLoadWorkspaceByPathRequest = {
  workspacePath: string
}

export type TanstackLoadWorkspaceByPathWireRequest = {
  requestId: string
  payload: TanstackLoadWorkspaceByPathRequest
}

export type TanstackLoadWorkspaceByPathResult =
  | {
      success: true
      workspace: TanstackRevisionEnvelope<TanstackWorkspace>
      promptFolders: Array<TanstackRevisionEnvelope<TanstackPromptFolder>>
    }
  | { success: false; error: string }
