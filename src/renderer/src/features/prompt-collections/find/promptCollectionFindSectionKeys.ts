import {
  PROMPT_COLLECTION_SETTINGS_FIND_SECTION_KEYS,
  type PromptCollectionSettingsField
} from '@shared/domain/prompt-collection/PromptCollection'

export const PROMPT_COLLECTION_FIND_TITLE_SECTION_KEY = 'title'
export const PROMPT_COLLECTION_FIND_BODY_SECTION_KEY = 'body'
export const PROMPT_COLLECTION_FIND_COLLECTION_DESCRIPTION_SECTION_KEY = 'collection-description'

export const PROMPT_COLLECTION_FIND_COLLECTION_SETTINGS_SECTION_KEYS: Record<
  PromptCollectionSettingsField,
  string
> = PROMPT_COLLECTION_SETTINGS_FIND_SECTION_KEYS
