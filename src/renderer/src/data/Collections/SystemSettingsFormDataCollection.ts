import { createCollection, localOnlyCollectionOptions } from '@tanstack/svelte-db'

export const SYSTEM_SETTINGS_FORM_DATA_ID = 'system-settings-form-data'

export type SystemSettingsFormDataRecord = {
  id: typeof SYSTEM_SETTINGS_FORM_DATA_ID
  promptFontSizeInput: string
  promptEditorMinLinesInput: string
  promptEditorMaxLinesInput: string
  showLineNumbers: boolean
}

// Local-only form data for system settings inputs.
export const systemSettingsFormDataCollection = createCollection(
  localOnlyCollectionOptions<SystemSettingsFormDataRecord>({
    id: 'system-settings-form-data',
    getKey: (formData) => formData.id
  })
)
