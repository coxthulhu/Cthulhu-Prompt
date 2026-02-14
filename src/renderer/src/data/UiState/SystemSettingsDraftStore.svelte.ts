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

export const setSystemSettingsDraftFontSizeInput = (value: string): void => {
  const currentDraft = getSystemSettingsDraftRecord()

  if (currentDraft.draftSnapshot.promptFontSizeInput === value) {
    return
  }

  mutateSystemSettingsDraftWithAutosave((draftRecord) => {
    draftRecord.draftSnapshot.promptFontSizeInput = value
  })
}

export const setSystemSettingsDraftPromptEditorMinLinesInput = (value: string): void => {
  const currentDraft = getSystemSettingsDraftRecord()

  if (currentDraft.draftSnapshot.promptEditorMinLinesInput === value) {
    return
  }

  mutateSystemSettingsDraftWithAutosave((draftRecord) => {
    draftRecord.draftSnapshot.promptEditorMinLinesInput = value
  })
}
