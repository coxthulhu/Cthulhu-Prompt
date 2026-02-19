import type { SystemSettings } from '@shared/SystemSettings'
import {
  SYSTEM_SETTINGS_DRAFT_ID,
  type SystemSettingsDraftRecord,
  systemSettingsDraftCollection
} from '../Collections/SystemSettingsDraftCollection'
import {
  getSystemSettingsDraftRecord,
  mutateSystemSettingsDraftWithAutosave
} from './SystemSettingsAutosave.svelte.ts'
import { toSystemSettingsDraftSnapshot } from './SystemSettingsFormat'

export const upsertSystemSettingsDraft = (settings: SystemSettings): void => {
  const nextSnapshot = toSystemSettingsDraftSnapshot(settings)
  const existingRecord = systemSettingsDraftCollection.get(SYSTEM_SETTINGS_DRAFT_ID)

  if (!existingRecord) {
    systemSettingsDraftCollection.insert({
      id: SYSTEM_SETTINGS_DRAFT_ID,
      promptFontSizeInput: nextSnapshot.promptFontSizeInput,
      promptEditorMinLinesInput: nextSnapshot.promptEditorMinLinesInput
    })
    return
  }

  systemSettingsDraftCollection.update(SYSTEM_SETTINGS_DRAFT_ID, (draftRecord) => {
    draftRecord.promptFontSizeInput = nextSnapshot.promptFontSizeInput
    draftRecord.promptEditorMinLinesInput = nextSnapshot.promptEditorMinLinesInput
  })
}

const updateSystemSettingsDraftInput = (
  value: string,
  selectInput: (draftRecord: SystemSettingsDraftRecord) => string,
  applyInput: (draftRecord: SystemSettingsDraftRecord, value: string) => void
): void => {
  const draftRecord = getSystemSettingsDraftRecord()
  if (selectInput(draftRecord) === value) {
    return
  }

  mutateSystemSettingsDraftWithAutosave((nextDraftRecord) => {
    applyInput(nextDraftRecord, value)
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
