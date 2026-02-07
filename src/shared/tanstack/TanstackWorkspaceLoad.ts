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

export type TanstackLoadWorkspaceByPathSuccess = {
  workspace: TanstackRevisionEnvelope<TanstackWorkspace>
  promptFolders: Array<TanstackRevisionEnvelope<TanstackPromptFolder>>
}

export type TanstackLoadWorkspaceByPathResult =
  | ({ success: true } & TanstackLoadWorkspaceByPathSuccess)
  | { success: false; error: string }
