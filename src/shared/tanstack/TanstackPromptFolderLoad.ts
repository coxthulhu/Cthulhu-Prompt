import type { TanstackPrompt } from './TanstackPrompt'
import type { TanstackPromptFolder } from './TanstackPromptFolder'
import type { TanstackRevisionEnvelope } from './TanstackRevision'

export type TanstackLoadPromptFolderInitialPayload = {
  workspaceId: string
  promptFolderId: string
}

export type TanstackLoadPromptFolderInitialWireRequest = {
  requestId: string
  payload: TanstackLoadPromptFolderInitialPayload
}

export type TanstackLoadPromptFolderInitialSuccess = {
  promptFolder: TanstackRevisionEnvelope<TanstackPromptFolder>
  prompts: Array<TanstackRevisionEnvelope<TanstackPrompt>>
}

export type TanstackLoadPromptFolderInitialResult =
  | ({ success: true } & TanstackLoadPromptFolderInitialSuccess)
  | { success: false; error: string }
