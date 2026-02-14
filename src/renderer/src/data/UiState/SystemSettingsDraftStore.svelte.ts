import { DEFAULT_SYSTEM_SETTINGS, type SystemSettings } from '@shared/SystemSettings'
import {
  SYSTEM_SETTINGS_DRAFT_ID,
  systemSettingsDraftCollection
} from '../Collections/SystemSettingsDraftCollection'
import {
  getSystemSettingsDraftRecord,
  mutateSystemSettingsDraftWithAutosave
} from './SystemSettingsAutosave.svelte.ts'
import {
  haveSameSystemSettings,
  type SystemSettingsDraftSnapshot,
  toSystemSettingsDraftSnapshot
} from './SystemSettingsFormat'

let lastSyncedSettings: SystemSettings = DEFAULT_SYSTEM_SETTINGS
let hasSyncedSettings = false

export const syncSystemSettingsDraft = (settings: SystemSettings): void => {
  if (hasSyncedSettings && haveSameSystemSettings(lastSyncedSettings, settings)) {
    return
  }

  hasSyncedSettings = true
  lastSyncedSettings = { ...settings }

  systemSettingsDraftCollection.update(SYSTEM_SETTINGS_DRAFT_ID, (draftRecord) => {
    draftRecord.draftSnapshot = toSystemSettingsDraftSnapshot(settings)
    draftRecord.saveError = null
  })
}

const updateSystemSettingsDraftInput = (
  value: string,
  selectInput: (snapshot: SystemSettingsDraftSnapshot) => string,
  applyInput: (snapshot: SystemSettingsDraftSnapshot, value: string) => void
): void => {
  const draftRecord = getSystemSettingsDraftRecord()
  if (selectInput(draftRecord.draftSnapshot) === value) {
    return
  }

  mutateSystemSettingsDraftWithAutosave((nextDraftRecord) => {
    applyInput(nextDraftRecord.draftSnapshot, value)
  })
}

export const setSystemSettingsDraftFontSizeInput = (value: string): void => {
  updateSystemSettingsDraftInput(
    value,
    (snapshot) => snapshot.promptFontSizeInput,
    (snapshot, nextValue) => {
      snapshot.promptFontSizeInput = nextValue
    }
  )
}

export const setSystemSettingsDraftPromptEditorMinLinesInput = (value: string): void => {
  updateSystemSettingsDraftInput(
    value,
    (snapshot) => snapshot.promptEditorMinLinesInput,
    (snapshot, nextValue) => {
      snapshot.promptEditorMinLinesInput = nextValue
    }
  )
}
