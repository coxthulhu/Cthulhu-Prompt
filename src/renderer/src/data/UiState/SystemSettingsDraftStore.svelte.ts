import type { SystemSettings } from '@shared/SystemSettings'
import {
  SYSTEM_SETTINGS_DRAFT_ID,
  systemSettingsDraftCollection
} from '../Collections/SystemSettingsDraftCollection'
import {
  getSystemSettingsDraftRecord,
  mutateSystemSettingsDraftWithAutosave
} from './SystemSettingsAutosave.svelte.ts'
import {
  type SystemSettingsDraftSnapshot,
  toSystemSettingsDraftSnapshot
} from './SystemSettingsFormat'

export const upsertSystemSettingsDraft = (settings: SystemSettings): void => {
  const nextSnapshot = toSystemSettingsDraftSnapshot(settings)
  const existingRecord = systemSettingsDraftCollection.get(SYSTEM_SETTINGS_DRAFT_ID)

  if (!existingRecord) {
    systemSettingsDraftCollection.insert({
      id: SYSTEM_SETTINGS_DRAFT_ID,
      draftSnapshot: nextSnapshot,
      saveError: null
    })
    return
  }

  systemSettingsDraftCollection.update(SYSTEM_SETTINGS_DRAFT_ID, (draftRecord) => {
    draftRecord.draftSnapshot = nextSnapshot
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
