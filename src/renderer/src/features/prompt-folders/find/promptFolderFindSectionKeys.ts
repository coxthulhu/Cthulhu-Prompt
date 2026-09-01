import {
  PROMPT_FOLDER_SETTINGS_FIND_SECTION_KEYS,
  type PromptFolderSettingsField
} from '@shared/PromptFolder'

export const PROMPT_FOLDER_FIND_TITLE_SECTION_KEY = 'title'
export const PROMPT_FOLDER_FIND_BODY_SECTION_KEY = 'body'
/** Find section key for an expanded category description editor. */
export const PROMPT_FOLDER_FIND_CATEGORY_DESCRIPTION_SECTION_KEY = 'category-description'
export const PROMPT_FOLDER_FIND_FOLDER_DESCRIPTION_SECTION_KEY = 'folder-description'

export const PROMPT_FOLDER_FIND_FOLDER_SETTINGS_SECTION_KEYS: Record<
  PromptFolderSettingsField,
  string
> = PROMPT_FOLDER_SETTINGS_FIND_SECTION_KEYS
