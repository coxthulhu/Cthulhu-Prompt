import type { Prompt } from './Prompt'
import type { RevisionEnvelope, RevisionPayloadEntity } from './Revision'
import type { Workspace } from './Workspace'

export interface PromptFolder {
  id: string
  folderName: string
  displayName: string
  promptCount: number
  promptIds: string[]
  folderDescription: string
}

export type PromptFolderRevisionPayload = {
  promptFolder: RevisionPayloadEntity<PromptFolder>
}

export type PromptFolderRevisionResponsePayload = {
  promptFolder: RevisionEnvelope<PromptFolder>
}

export type CreatePromptFolderPayload = {
  workspace: RevisionPayloadEntity<Workspace>
  promptFolderId: string
  displayName: string
}

export type CreatePromptFolderResponsePayload = {
  workspace: RevisionEnvelope<Workspace>
  promptFolder?: RevisionEnvelope<PromptFolder>
}

export type LoadPromptFolderInitialPayload = {
  workspaceId: string
  promptFolderId: string
}

export type LoadPromptFolderInitialResult =
  | {
      success: true
      promptFolder: RevisionEnvelope<PromptFolder>
      prompts: Array<RevisionEnvelope<Prompt>>
    }
  | { success: false; error: string }
