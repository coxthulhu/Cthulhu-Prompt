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

export type TanstackLoadPromptFolderInitialResult =
  | {
      success: true
      promptFolder: TanstackRevisionEnvelope<TanstackPromptFolder>
      prompts: Array<TanstackRevisionEnvelope<TanstackPrompt>>
    }
  | { success: false; error: string }
