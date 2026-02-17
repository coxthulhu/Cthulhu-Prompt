import { createCollection, localOnlyCollectionOptions } from '@tanstack/svelte-db'

export const SYSTEM_SETTINGS_DRAFT_ID = 'system-settings-draft'

export type SystemSettingsDraftRecord = {
  id: typeof SYSTEM_SETTINGS_DRAFT_ID
  promptFontSizeInput: string
  promptEditorMinLinesInput: string
}

// Local-only UI draft state for settings form inputs.
export const systemSettingsDraftCollection = createCollection(
  localOnlyCollectionOptions<SystemSettingsDraftRecord>({
    id: 'system-settings-drafts',
    getKey: (draft) => draft.id
  })
)
