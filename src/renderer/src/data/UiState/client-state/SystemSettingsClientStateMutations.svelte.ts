import type { NewPromptFocus, SystemSettings, UpdateChannel } from '@shared/domain/settings/SystemSettings'
import {
  SYSTEM_SETTINGS_CLIENT_STATE_ID,
  type SystemSettingsClientStateRecord,
  systemSettingsClientStateCollection
} from '@renderer/data/Collections/SystemSettingsClientStateCollection'
import {
  getSystemSettingsClientStateRecord,
  mutateSystemSettingsClientStateWithAutosave
} from '@renderer/data/UiState/autosave/SystemSettingsAutosave.svelte.ts'
import { toSystemSettingsFormData } from '@renderer/data/UiState/client-state/SystemSettingsFormat'

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
      attachedNoteReservedLinesInput: nextFormData.attachedNoteReservedLinesInput,
      showLineNumbers: nextFormData.showLineNumbers,
      newPromptFocus: nextFormData.newPromptFocus,
      automaticUpdates: nextFormData.automaticUpdates,
      updateChannel: nextFormData.updateChannel
    })
    return
  }

  systemSettingsClientStateCollection.update(SYSTEM_SETTINGS_CLIENT_STATE_ID, (clientState) => {
    clientState.promptFontSizeInput = nextFormData.promptFontSizeInput
    clientState.promptEditorMinLinesInput = nextFormData.promptEditorMinLinesInput
    clientState.promptEditorMaxLinesInput = nextFormData.promptEditorMaxLinesInput
    clientState.attachedNoteReservedLinesInput = nextFormData.attachedNoteReservedLinesInput
    clientState.showLineNumbers = nextFormData.showLineNumbers
    clientState.newPromptFocus = nextFormData.newPromptFocus
    clientState.automaticUpdates = nextFormData.automaticUpdates
    clientState.updateChannel = nextFormData.updateChannel
  })
}

/** Editable system-settings field stored in renderer-session client state. */
type SystemSettingsClientStateField = Exclude<keyof SystemSettingsClientStateRecord, 'id'>

/** Applies one changed system-settings field through the autosave transaction. */
export const setSystemSettingsClientStateField = <TField extends SystemSettingsClientStateField>(
  field: TField,
  value: SystemSettingsClientStateRecord[TField]
): void => {
  if (getSystemSettingsClientStateRecord()[field] === value) {
    return
  }

  mutateSystemSettingsClientStateWithAutosave((nextClientState) => {
    nextClientState[field] = value
  })
}

/** Updates the client-side font-size input. */
export const setSystemSettingsClientStateFontSizeInput = (value: string): void =>
  setSystemSettingsClientStateField('promptFontSizeInput', value)

/** Updates the client-side minimum editor-lines input. */
export const setSystemSettingsClientStatePromptEditorMinLinesInput = (value: string): void =>
  setSystemSettingsClientStateField('promptEditorMinLinesInput', value)

/** Updates the client-side maximum editor-lines input. */
export const setSystemSettingsClientStatePromptEditorMaxLinesInput = (value: string): void =>
  setSystemSettingsClientStateField('promptEditorMaxLinesInput', value)

/** Updates the note reserved lines input. */
export const setSystemSettingsClientStateAttachedNoteReservedLinesInput = (value: string): void =>
  setSystemSettingsClientStateField('attachedNoteReservedLinesInput', value)

/** Updates the client-side line-number toggle. */
export const setSystemSettingsClientStateShowLineNumbers = (value: boolean): void =>
  setSystemSettingsClientStateField('showLineNumbers', value)

/** Updates the preferred initial focus for new prompts and templates. */
export const setSystemSettingsClientStateNewPromptFocus = (value: NewPromptFocus): void =>
  setSystemSettingsClientStateField('newPromptFocus', value)

/** Updates automatic update discovery through the existing settings autosave. */
export const setSystemSettingsClientStateAutomaticUpdates = (value: boolean): void =>
  setSystemSettingsClientStateField('automaticUpdates', value)

/** Updates the auto-updater release channel through the existing settings autosave. */
export const setSystemSettingsClientStateUpdateChannel = (value: UpdateChannel): void =>
  setSystemSettingsClientStateField('updateChannel', value)
