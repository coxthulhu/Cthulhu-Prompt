import { createCollection, localOnlyCollectionOptions } from '@tanstack/svelte-db'
import { DEFAULT_SYSTEM_SETTINGS } from '@shared/SystemSettings'

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

const defaultSystemSettingsDraft: SystemSettingsDraftRecord = {
  id: SYSTEM_SETTINGS_DRAFT_ID,
  draftSnapshot: {
    promptFontSizeInput: String(DEFAULT_SYSTEM_SETTINGS.promptFontSize),
    promptEditorMinLinesInput: String(DEFAULT_SYSTEM_SETTINGS.promptEditorMinLines)
  },
  saveError: null
}

// Local-only UI draft state for settings form inputs.
export const systemSettingsDraftCollection = createCollection(
  localOnlyCollectionOptions<SystemSettingsDraftRecord>({
    id: 'system-settings-drafts',
    getKey: (draft) => draft.id,
    initialData: [defaultSystemSettingsDraft]
  })
)
