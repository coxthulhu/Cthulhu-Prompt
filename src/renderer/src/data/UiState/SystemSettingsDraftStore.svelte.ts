import {
  DEFAULT_SYSTEM_SETTINGS,
  type SystemSettings
} from '@shared/SystemSettings'
import {
  AUTOSAVE_MS,
  clearAutosaveTimeout,
  createAutosaveController,
  type AutosaveDraft
} from '@renderer/data/draftAutosave'
import { updateSystemSettings } from '../Mutations/SystemSettingsMutations'
import {
  getSystemSettingsValidation as getSystemSettingsValidationForSnapshot,
  haveSameSystemSettings,
  normalizePromptEditorMinLinesInput,
  normalizePromptFontSizeInput,
  toSystemSettingsDraftSnapshot,
  type SystemSettingsDraftSnapshot,
  type SystemSettingsValidation
} from './SystemSettingsFormat'

type SystemSettingsDraftState = {
  draftSnapshot: SystemSettingsDraftSnapshot
  saveError: string | null
}

const draftState = $state<SystemSettingsDraftState>({
  draftSnapshot: toSystemSettingsDraftSnapshot(DEFAULT_SYSTEM_SETTINGS),
  saveError: null
})

const autosaveDraft = $state<AutosaveDraft>({
  dirty: false,
  saving: false,
  autosaveTimeoutId: null
})

let lastSyncedSettings: SystemSettings = DEFAULT_SYSTEM_SETTINGS
let hasSyncedSettings = false

export const getSystemSettingsValidation = (): SystemSettingsValidation => {
  return getSystemSettingsValidationForSnapshot(draftState.draftSnapshot)
}

const syncDraftSnapshot = (settings: SystemSettings): void => {
  draftState.draftSnapshot = toSystemSettingsDraftSnapshot(settings)
  draftState.saveError = null
  autosaveDraft.dirty = false
}

export const syncSystemSettingsDraft = (settings: SystemSettings): void => {
  if (hasSyncedSettings && haveSameSystemSettings(lastSyncedSettings, settings)) {
    return
  }

  hasSyncedSettings = true
  lastSyncedSettings = { ...settings }
  clearAutosaveTimeout(autosaveDraft)
  syncDraftSnapshot(settings)
}

const autosave = createAutosaveController({
  draft: autosaveDraft,
  autosaveMs: AUTOSAVE_MS,
  save: async () => {
    const validation = getSystemSettingsValidation()

    if (validation.fontSizeError || validation.minLinesError) {
      return
    }

    const fontSize = normalizePromptFontSizeInput(draftState.draftSnapshot.promptFontSizeInput)
    const minLines = normalizePromptEditorMinLinesInput(
      draftState.draftSnapshot.promptEditorMinLinesInput
    )

    draftState.saveError = null
    await updateSystemSettings({
      promptFontSize: fontSize.rounded,
      promptEditorMinLines: minLines.rounded
    })
    autosaveDraft.dirty = false
  }
})

export const getSystemSettingsDraftState = (): SystemSettingsDraftState => {
  return draftState
}

export const getSystemSettingsAutosaveDraft = (): AutosaveDraft => {
  return autosaveDraft
}

export const setSystemSettingsDraftFontSizeInput = (value: string): void => {
  if (draftState.draftSnapshot.promptFontSizeInput === value) return
  draftState.draftSnapshot.promptFontSizeInput = value
  draftState.saveError = null
  autosave.markDirtyAndScheduleAutosave()
}

export const setSystemSettingsDraftPromptEditorMinLinesInput = (value: string): void => {
  if (draftState.draftSnapshot.promptEditorMinLinesInput === value) return
  draftState.draftSnapshot.promptEditorMinLinesInput = value
  draftState.saveError = null
  autosave.markDirtyAndScheduleAutosave()
}

export const saveSystemSettingsDraftNow = async (): Promise<void> => {
  try {
    await autosave.saveNow()
  } catch (error) {
    draftState.saveError = error instanceof Error ? error.message : 'Failed to update system settings.'
    throw error
  }
}

export const flushSystemSettingsAutosave = async (): Promise<void> => {
  clearAutosaveTimeout(autosaveDraft)
  await saveSystemSettingsDraftNow()
}
