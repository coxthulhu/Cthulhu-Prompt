import {
  PROMPT_FOLDER_SETTINGS_FIELDS,
  PROMPT_FOLDER_SETTINGS_FIND_SECTION_KEYS,
  type PromptFolderSettingsField
} from '@shared/PromptFolder'

export const PROMPT_FOLDER_SETTINGS_ROW_ID = 'folder-settings'
export const PROMPT_FOLDER_SETTINGS_GUTTER_TAIL_ROW_ID = 'folder-settings-gutter-tail'

export const promptEditorRowId = (promptId: string): string => `${promptId}-editor`

export const promptDividerRowId = (promptId: string): string => `${promptId}-divider`

export const promptFolderSettingsFindEntityId = (
  promptFolderId: string,
  field: PromptFolderSettingsField
): string => `folder-settings:${promptFolderId}:${field}`

export const isPromptFolderSettingsFindEntityId = (
  entityId: string,
  promptFolderId: string
): boolean => entityId.startsWith(`folder-settings:${promptFolderId}:`)

export const promptFolderSettingsFieldFromFindSectionKey = (
  sectionKey: string
): PromptFolderSettingsField | null => {
  return (
    PROMPT_FOLDER_SETTINGS_FIELDS.find(
      (field) => PROMPT_FOLDER_SETTINGS_FIND_SECTION_KEYS[field] === sectionKey
    ) ?? null
  )
}
