import type { SystemSettings } from '@shared/SystemSettings'
import {
  SYSTEM_SETTINGS_FORM_DATA_ID,
  type SystemSettingsFormDataRecord,
  systemSettingsFormDataCollection
} from '../Collections/SystemSettingsFormDataCollection'
import {
  getSystemSettingsFormDataRecord,
  mutateSystemSettingsFormDataWithAutosave
} from './SystemSettingsAutosave.svelte.ts'
import { toSystemSettingsFormData } from './SystemSettingsFormat'

export const upsertSystemSettingsFormData = (settings: SystemSettings): void => {
  const nextFormData = toSystemSettingsFormData(settings)
  const existingRecord = systemSettingsFormDataCollection.get(SYSTEM_SETTINGS_FORM_DATA_ID)

  if (!existingRecord) {
    systemSettingsFormDataCollection.insert({
      id: SYSTEM_SETTINGS_FORM_DATA_ID,
      promptFontSizeInput: nextFormData.promptFontSizeInput,
      promptEditorMinLinesInput: nextFormData.promptEditorMinLinesInput,
      promptEditorMaxLinesInput: nextFormData.promptEditorMaxLinesInput,
      showLineNumbers: nextFormData.showLineNumbers
    })
    return
  }

  systemSettingsFormDataCollection.update(SYSTEM_SETTINGS_FORM_DATA_ID, (formDataRecord) => {
    formDataRecord.promptFontSizeInput = nextFormData.promptFontSizeInput
    formDataRecord.promptEditorMinLinesInput = nextFormData.promptEditorMinLinesInput
    formDataRecord.promptEditorMaxLinesInput = nextFormData.promptEditorMaxLinesInput
    formDataRecord.showLineNumbers = nextFormData.showLineNumbers
  })
}

const updateSystemSettingsFormDataInput = (
  value: string,
  selectInput: (formDataRecord: SystemSettingsFormDataRecord) => string,
  applyInput: (formDataRecord: SystemSettingsFormDataRecord, value: string) => void
): void => {
  const formDataRecord = getSystemSettingsFormDataRecord()
  if (selectInput(formDataRecord) === value) {
    return
  }

  mutateSystemSettingsFormDataWithAutosave((nextFormDataRecord) => {
    applyInput(nextFormDataRecord, value)
  })
}

export const setSystemSettingsFormDataFontSizeInput = (value: string): void => {
  updateSystemSettingsFormDataInput(
    value,
    (formData) => formData.promptFontSizeInput,
    (formData, nextValue) => {
      formData.promptFontSizeInput = nextValue
    }
  )
}

export const setSystemSettingsFormDataPromptEditorMinLinesInput = (value: string): void => {
  updateSystemSettingsFormDataInput(
    value,
    (formData) => formData.promptEditorMinLinesInput,
    (formData, nextValue) => {
      formData.promptEditorMinLinesInput = nextValue
    }
  )
}

export const setSystemSettingsFormDataPromptEditorMaxLinesInput = (value: string): void => {
  updateSystemSettingsFormDataInput(
    value,
    (formData) => formData.promptEditorMaxLinesInput,
    (formData, nextValue) => {
      formData.promptEditorMaxLinesInput = nextValue
    }
  )
}

export const setSystemSettingsFormDataShowLineNumbers = (value: boolean): void => {
  const formDataRecord = getSystemSettingsFormDataRecord()
  if (formDataRecord.showLineNumbers === value) {
    return
  }

  mutateSystemSettingsFormDataWithAutosave((nextFormDataRecord) => {
    nextFormDataRecord.showLineNumbers = value
  })
}
