import type { PromptPersisted } from './Prompt'
import type { PromptTemplatePersisted } from './PromptTemplate'
import type { EntryRef, OrderContainer } from './OrderContainer'
import type { RevisionEnvelope, RevisionPayloadEntity } from './Revision'
import type { IpcResult } from './IpcResult'
import type { Workspace } from './Workspace'
import type { PromptUiState } from './PromptUiState'

export type PromptFolderKind = 'prompt' | 'template'

interface PromptFolderBase extends OrderContainer<EntryRef> {
  id: string
  folderName: string
  displayName: string
  completedPromptIds: string[]
}

export interface PromptContentFolder extends PromptFolderBase {
  kind: 'prompt'
  settings: PromptFolderSettings
}

export interface PromptTemplateFolder extends PromptFolderBase {
  kind: 'template'
  settings: PromptTemplateFolderSettings
}

export type PromptFolder = PromptContentFolder | PromptTemplateFolder

export const PROMPT_FOLDER_SETTINGS_FIELDS = [
  'folderDescription',
  'folderPrefix',
  'folderSuffix'
] as const

export type PromptFolderSettingsField = (typeof PROMPT_FOLDER_SETTINGS_FIELDS)[number]

export type PromptFolderSettings = Record<PromptFolderSettingsField, string | null>

export type PromptTemplateFolderSettings = {
  folderDescription: string | null
}

export type AnyPromptFolderSettings = PromptFolderSettings | PromptTemplateFolderSettings

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

export function createEmptyPromptFolderSettings(kind: 'template'): PromptTemplateFolderSettings
export function createEmptyPromptFolderSettings(kind?: 'prompt'): PromptFolderSettings
export function createEmptyPromptFolderSettings(kind: PromptFolderKind): AnyPromptFolderSettings
export function createEmptyPromptFolderSettings(
  kind: PromptFolderKind = 'prompt'
): AnyPromptFolderSettings {
  return kind === 'template'
    ? { folderDescription: null }
    : {
        folderDescription: null,
        folderPrefix: null,
        folderSuffix: null
      }
}

export function copyPromptFolderSettings(settings: PromptFolderSettings): PromptFolderSettings
export function copyPromptFolderSettings(
  settings: PromptTemplateFolderSettings
): PromptTemplateFolderSettings
export function copyPromptFolderSettings(settings: AnyPromptFolderSettings): AnyPromptFolderSettings
export function copyPromptFolderSettings(
  settings: AnyPromptFolderSettings
): AnyPromptFolderSettings {
  return 'folderPrefix' in settings
    ? {
        folderDescription: settings.folderDescription,
        folderPrefix: settings.folderPrefix,
        folderSuffix: settings.folderSuffix
      }
    : { folderDescription: settings.folderDescription }
}

export const haveSamePromptFolderSettings = (
  left: AnyPromptFolderSettings,
  right: AnyPromptFolderSettings
): boolean => {
  if ('folderPrefix' in left !== 'folderPrefix' in right) {
    return false
  }

  if ('folderPrefix' in left && 'folderPrefix' in right) {
    return PROMPT_FOLDER_SETTINGS_FIELDS.every((field) => left[field] === right[field])
  }

  return left.folderDescription === right.folderDescription
}

export type UpdatePromptFolderSettingsPayload = {
  promptFolder: RevisionPayloadEntity<AnyPromptFolderSettings>
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
  kind: PromptFolderKind
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
  promptTemplates: Array<RevisionEnvelope<PromptTemplatePersisted>>
  promptUiStates: Array<RevisionEnvelope<PromptUiState>>
}>
