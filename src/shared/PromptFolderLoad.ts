import type { Prompt } from './Prompt'
import type { PromptFolder } from './PromptFolder'
import type { RevisionEnvelope } from './Revision'

export type LoadPromptFolderInitialPayload = {
  workspaceId: string
  promptFolderId: string
}

export type LoadPromptFolderInitialWireRequest = {
  requestId: string
  payload: LoadPromptFolderInitialPayload
}

export type LoadPromptFolderInitialResult =
  | {
      success: true
      promptFolder: RevisionEnvelope<PromptFolder>
      prompts: Array<RevisionEnvelope<Prompt>>
    }
  | { success: false; error: string }
