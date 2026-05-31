import type { PromptFolderSettingsField } from '@shared/PromptFolder'

export const PROMPT_FOLDER_FIND_TITLE_SECTION_KEY = 'title'
export const PROMPT_FOLDER_FIND_BODY_SECTION_KEY = 'body'
export const PROMPT_FOLDER_FIND_FOLDER_DESCRIPTION_SECTION_KEY = 'folder-description'
export const PROMPT_FOLDER_FIND_FOLDER_PREFIX_SECTION_KEY = 'folder-prefix'
export const PROMPT_FOLDER_FIND_FOLDER_SUFFIX_SECTION_KEY = 'folder-suffix'

export const PROMPT_FOLDER_FIND_FOLDER_SETTINGS_SECTION_KEYS: Record<
  PromptFolderSettingsField,
  string
> = {
  folderDescription: PROMPT_FOLDER_FIND_FOLDER_DESCRIPTION_SECTION_KEY,
  folderPrefix: PROMPT_FOLDER_FIND_FOLDER_PREFIX_SECTION_KEY,
  folderSuffix: PROMPT_FOLDER_FIND_FOLDER_SUFFIX_SECTION_KEY
}
