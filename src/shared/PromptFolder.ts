import type { PromptPersisted } from './Prompt'
import type { EntryRef, OrderContainer } from './OrderContainer'
import type { RevisionEnvelope, RevisionPayloadEntity } from './Revision'
import type { IpcResult } from './IpcResult'
import type { Workspace } from './Workspace'
import type { PromptUiState } from './PromptUiState'

export interface PromptFolder extends OrderContainer<EntryRef> {
  id: string
  folderName: string
  displayName: string
  completedPromptIds: string[]
  settings: PromptFolderSettings
}

export const PROMPT_FOLDER_SETTINGS_FIELDS = [
  'folderDescription',
  'folderPrefix',
  'folderSuffix'
] as const

export type PromptFolderSettingsField = (typeof PROMPT_FOLDER_SETTINGS_FIELDS)[number]

export type PromptFolderSettings = Record<PromptFolderSettingsField, string>

export type PromptFolderSettingsFieldMetadata = {
  field: PromptFolderSettingsField
  diskFilename: string
  monacoModelUriSegment: string
  findSectionKey: string
}

export const PROMPT_FOLDER_SETTINGS_FIELD_METADATA = [
  {
    field: 'folderDescription',
    diskFilename: 'Description.md',
    monacoModelUriSegment: 'folder-descriptions',
    findSectionKey: 'folder-description'
  },
  {
    field: 'folderPrefix',
    diskFilename: 'PromptPrefix.md',
    monacoModelUriSegment: 'folder-prefixes',
    findSectionKey: 'folder-prefix'
  },
  {
    field: 'folderSuffix',
    diskFilename: 'PromptSuffix.md',
    monacoModelUriSegment: 'folder-suffixes',
    findSectionKey: 'folder-suffix'
  }
] as const satisfies readonly PromptFolderSettingsFieldMetadata[]

export const PROMPT_FOLDER_SETTINGS_DISK_FILENAMES = Object.fromEntries(
  PROMPT_FOLDER_SETTINGS_FIELD_METADATA.map(({ field, diskFilename }) => [field, diskFilename])
) as Record<PromptFolderSettingsField, string>

export const PROMPT_FOLDER_SETTINGS_MONACO_MODEL_URI_SEGMENTS = Object.fromEntries(
  PROMPT_FOLDER_SETTINGS_FIELD_METADATA.map(({ field, monacoModelUriSegment }) => [
    field,
    monacoModelUriSegment
  ])
) as Record<PromptFolderSettingsField, string>

export const PROMPT_FOLDER_SETTINGS_FIND_SECTION_KEYS = Object.fromEntries(
  PROMPT_FOLDER_SETTINGS_FIELD_METADATA.map(({ field, findSectionKey }) => [field, findSectionKey])
) as Record<PromptFolderSettingsField, string>

export const createEmptyPromptFolderSettings = (): PromptFolderSettings => ({
  folderDescription: '',
  folderPrefix: '',
  folderSuffix: ''
})

export const copyPromptFolderSettings = (settings: PromptFolderSettings): PromptFolderSettings => ({
  folderDescription: settings.folderDescription,
  folderPrefix: settings.folderPrefix,
  folderSuffix: settings.folderSuffix
})

export const haveSamePromptFolderSettings = (
  left: PromptFolderSettings,
  right: PromptFolderSettings
): boolean => {
  return PROMPT_FOLDER_SETTINGS_FIELDS.every((field) => left[field] === right[field])
}

export type UpdatePromptFolderSettingsPayload = {
  promptFolder: RevisionPayloadEntity<PromptFolderSettings>
}

export type PromptFolderRevisionResponsePayload = {
  promptFolder: RevisionEnvelope<PromptFolder>
}

export type RenamePromptFolderPayload = {
  promptFolder: RevisionPayloadEntity<PromptFolder>
  displayName: string
}

export type CreatePromptFolderPayload = {
  workspace: RevisionPayloadEntity<Workspace>
  parentPromptFolder: RevisionPayloadEntity<PromptFolder> | null
  promptFolderId: string
  displayName: string
  previousEntryId: string | null
}

export type CreatePromptFolderResponsePayload = {
  workspace?: RevisionEnvelope<Workspace>
  parentPromptFolder?: RevisionEnvelope<PromptFolder>
  promptFolder?: RevisionEnvelope<PromptFolder>
}

export type DeletePromptFolderPayload = {
  workspace: RevisionPayloadEntity<Workspace>
  parentPromptFolder: RevisionPayloadEntity<PromptFolder> | null
  promptFolder: RevisionPayloadEntity<PromptFolder>
}

export type DeletePromptFolderResponsePayload = {
  workspace?: RevisionEnvelope<Workspace>
  parentPromptFolder?: RevisionEnvelope<PromptFolder>
  promptFolder?: RevisionEnvelope<PromptFolder>
}

export type LoadPromptFolderInitialPayload = {
  workspaceId: string
  promptFolderId: string
}

export type LoadPromptFolderInitialResult = IpcResult<{
  promptFolders: Array<RevisionEnvelope<PromptFolder>>
  prompts: Array<RevisionEnvelope<PromptPersisted>>
  promptUiStates: Array<RevisionEnvelope<PromptUiState>>
}>
