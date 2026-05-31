import type { PromptPersisted } from './Prompt'
import type { RevisionEnvelope, RevisionPayloadEntity } from './Revision'
import type { IpcResult } from './IpcResult'
import type { Workspace } from './Workspace'
import type { PromptUiState } from './PromptUiState'

export interface PromptFolder {
  id: string
  folderName: string
  displayName: string
  promptCount: number
  promptIds: string[]
  folderDescription: string
  folderPrefix: string
  folderSuffix: string
}

export const PROMPT_FOLDER_SETTINGS_FIELDS = [
  'folderDescription',
  'folderPrefix',
  'folderSuffix'
] as const

export type PromptFolderSettingsField = (typeof PROMPT_FOLDER_SETTINGS_FIELDS)[number]

export type PromptFolderSettingsUpdate = Pick<PromptFolder, PromptFolderSettingsField>

export const createEmptyPromptFolderSettings = (): PromptFolderSettingsUpdate => ({
  folderDescription: '',
  folderPrefix: '',
  folderSuffix: ''
})

export type UpdatePromptFolderSettingsPayload = {
  promptFolder: RevisionPayloadEntity<PromptFolderSettingsUpdate>
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

export type LoadPromptFolderInitialResult = IpcResult<{
  promptFolder: RevisionEnvelope<PromptFolder>
  prompts: Array<RevisionEnvelope<PromptPersisted>>
  promptUiStates: Array<RevisionEnvelope<PromptUiState>>
}>
