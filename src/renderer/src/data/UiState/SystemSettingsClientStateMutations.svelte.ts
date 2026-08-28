import type { SystemSettings } from '@shared/SystemSettings'
import {
  SYSTEM_SETTINGS_CLIENT_STATE_ID,
  type SystemSettingsClientStateRecord,
  systemSettingsClientStateCollection
} from '../Collections/SystemSettingsClientStateCollection'
import {
  getSystemSettingsClientStateRecord,
  mutateSystemSettingsClientStateWithAutosave
} from './SystemSettingsAutosave.svelte.ts'
import { toSystemSettingsFormData } from './SystemSettingsFormat'

/** Reconciles system-settings client state from authoritative settings. */
export const upsertSystemSettingsClientState = (settings: SystemSettings): void => {
  const nextFormData = toSystemSettingsFormData(settings)
  const existingRecord = systemSettingsClientStateCollection.get(SYSTEM_SETTINGS_CLIENT_STATE_ID)

  if (!existingRecord) {
    systemSettingsClientStateCollection.insert({
      id: SYSTEM_SETTINGS_CLIENT_STATE_ID,
      promptFontSizeInput: nextFormData.promptFontSizeInput,
      promptEditorMinLinesInput: nextFormData.promptEditorMinLinesInput,
      promptEditorMaxLinesInput: nextFormData.promptEditorMaxLinesInput,
      showLineNumbers: nextFormData.showLineNumbers
    })
    return
  }

  systemSettingsClientStateCollection.update(SYSTEM_SETTINGS_CLIENT_STATE_ID, (clientState) => {
    clientState.promptFontSizeInput = nextFormData.promptFontSizeInput
    clientState.promptEditorMinLinesInput = nextFormData.promptEditorMinLinesInput
    clientState.promptEditorMaxLinesInput = nextFormData.promptEditorMaxLinesInput
    clientState.showLineNumbers = nextFormData.showLineNumbers
  })
}

/** Applies one changed system-settings input through the autosave transaction. */
const updateSystemSettingsClientStateInput = (
  value: string,
  selectInput: (clientState: SystemSettingsClientStateRecord) => string,
  applyInput: (clientState: SystemSettingsClientStateRecord, value: string) => void
): void => {
  const clientState = getSystemSettingsClientStateRecord()
  if (selectInput(clientState) === value) {
    return
  }

  mutateSystemSettingsClientStateWithAutosave((nextClientState) => {
    applyInput(nextClientState, value)
  })
}

/** Updates the client-side font-size input. */
export const setSystemSettingsClientStateFontSizeInput = (value: string): void => {
  updateSystemSettingsClientStateInput(
    value,
    (formData) => formData.promptFontSizeInput,
    (formData, nextValue) => {
      formData.promptFontSizeInput = nextValue
    }
  )
}

/** Updates the client-side minimum editor-lines input. */
export const setSystemSettingsClientStatePromptEditorMinLinesInput = (value: string): void => {
  updateSystemSettingsClientStateInput(
    value,
    (formData) => formData.promptEditorMinLinesInput,
    (formData, nextValue) => {
      formData.promptEditorMinLinesInput = nextValue
    }
  )
}

/** Updates the client-side maximum editor-lines input. */
export const setSystemSettingsClientStatePromptEditorMaxLinesInput = (value: string): void => {
  updateSystemSettingsClientStateInput(
    value,
    (formData) => formData.promptEditorMaxLinesInput,
    (formData, nextValue) => {
      formData.promptEditorMaxLinesInput = nextValue
    }
  )
}

/** Updates the client-side line-number toggle. */
export const setSystemSettingsClientStateShowLineNumbers = (value: boolean): void => {
  const clientState = getSystemSettingsClientStateRecord()
  if (clientState.showLineNumbers === value) {
    return
  }

  mutateSystemSettingsClientStateWithAutosave((nextClientState) => {
    nextClientState.showLineNumbers = value
  })
}
