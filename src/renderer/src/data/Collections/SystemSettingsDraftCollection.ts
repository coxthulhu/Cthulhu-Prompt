import { createCollection, localOnlyCollectionOptions } from '@tanstack/svelte-db'

export const SYSTEM_SETTINGS_DRAFT_ID = 'system-settings-draft'

export type SystemSettingsDraftSnapshot = {
  promptFontSizeInput: string
  promptEditorMinLinesInput: string
}

export type SystemSettingsDraftRecord = {
  id: typeof SYSTEM_SETTINGS_DRAFT_ID
  draftSnapshot: SystemSettingsDraftSnapshot
  saveError: string | null
}

// Local-only UI draft state for settings form inputs.
export const systemSettingsDraftCollection = createCollection(
  localOnlyCollectionOptions<SystemSettingsDraftRecord>({
    id: 'system-settings-drafts',
    getKey: (draft) => draft.id
  })
)
