import {
  DEFAULT_SYSTEM_SETTINGS,
  SYSTEM_SETTINGS_ID,
  type SystemSettings
} from '@shared/SystemSettings'
import type { Transaction } from '@tanstack/svelte-db'
import { AUTOSAVE_MS } from '@renderer/data/draftAutosave'
import {
  SYSTEM_SETTINGS_DRAFT_ID,
  type SystemSettingsDraftRecord,
  systemSettingsDraftCollection
} from '../Collections/SystemSettingsDraftCollection'
import { systemSettingsCollection } from '../Collections/SystemSettingsCollection'
import {
  submitOpenUpdateTransactionAndWait
} from '../IpcFramework/RevisionCollections'
import { getLatestMutationModifiedRecord } from '../IpcFramework/RevisionMutationLookup'
import { mutateOpenSystemSettingsAutosaveUpdate } from '../Mutations/SystemSettingsMutations'
import {
  getSystemSettingsValidation as getSystemSettingsValidationForSnapshot,
  haveSameSystemSettings,
  normalizePromptEditorMinLinesInput,
  normalizePromptFontSizeInput,
  toSystemSettingsDraftSnapshot,
  type SystemSettingsValidation
} from './SystemSettingsFormat'

export type SystemSettingsAutosaveState = {
  saving: boolean
}

const autosaveState = $state<SystemSettingsAutosaveState>({
  saving: false
})

let lastSyncedSettings: SystemSettings = DEFAULT_SYSTEM_SETTINGS
let hasSyncedSettings = false

const getSystemSettingsDraftRecord = (): SystemSettingsDraftRecord => {
  return systemSettingsDraftCollection.get(SYSTEM_SETTINGS_DRAFT_ID)!
}

const getSystemSettingsDraftRecordFromTransaction = (
  transaction: Transaction<any>
): SystemSettingsDraftRecord => {
  return getLatestMutationModifiedRecord(
    transaction,
    systemSettingsDraftCollection.id,
    SYSTEM_SETTINGS_DRAFT_ID,
    getSystemSettingsDraftRecord
  )
}

const getValidatedSystemSettingsFromDraftRecord = (
  draftRecord: SystemSettingsDraftRecord
): SystemSettings | null => {
  const validation = getSystemSettingsValidationForSnapshot(draftRecord.draftSnapshot)
  if (validation.fontSizeError || validation.minLinesError) {
    return null
  }

  return {
    promptFontSize: normalizePromptFontSizeInput(draftRecord.draftSnapshot.promptFontSizeInput).rounded,
    promptEditorMinLines: normalizePromptEditorMinLinesInput(
      draftRecord.draftSnapshot.promptEditorMinLinesInput
    ).rounded
  }
}

const scheduleSystemSettingsAutosaveMutation = (
  applyDraftUpdate: (draftRecord: SystemSettingsDraftRecord) => void
): void => {
  mutateOpenSystemSettingsAutosaveUpdate({
    debounceMs: AUTOSAVE_MS,
    mutateOptimistically: () => {
      systemSettingsDraftCollection.update(SYSTEM_SETTINGS_DRAFT_ID, (draftRecord) => {
        applyDraftUpdate(draftRecord)
        draftRecord.saveError = null
      })
    },
    validateBeforeEnqueue: (transaction) => {
      const draftRecord = getSystemSettingsDraftRecordFromTransaction(transaction)
      const validatedSettings = getValidatedSystemSettingsFromDraftRecord(draftRecord)
      if (!validatedSettings) {
        return false
      }

      transaction.mutate(() => {
        systemSettingsCollection.update(SYSTEM_SETTINGS_ID, (draft) => {
          draft.promptFontSize = validatedSettings.promptFontSize
          draft.promptEditorMinLines = validatedSettings.promptEditorMinLines
        })
      })

      return true
    }
  })
}

export const getSystemSettingsValidation = (): SystemSettingsValidation => {
  return getSystemSettingsValidationForSnapshot(getSystemSettingsDraftRecord().draftSnapshot)
}

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

export const getSystemSettingsAutosaveDraft = (): SystemSettingsAutosaveState => {
  return autosaveState
}

export const setSystemSettingsDraftFontSizeInput = (value: string): void => {
  const currentDraft = getSystemSettingsDraftRecord()

  if (currentDraft.draftSnapshot.promptFontSizeInput === value) {
    return
  }

  scheduleSystemSettingsAutosaveMutation((draftRecord) => {
    draftRecord.draftSnapshot.promptFontSizeInput = value
  })
}

export const setSystemSettingsDraftPromptEditorMinLinesInput = (value: string): void => {
  const currentDraft = getSystemSettingsDraftRecord()

  if (currentDraft.draftSnapshot.promptEditorMinLinesInput === value) {
    return
  }

  scheduleSystemSettingsAutosaveMutation((draftRecord) => {
    draftRecord.draftSnapshot.promptEditorMinLinesInput = value
  })
}

export const saveSystemSettingsDraftNow = async (): Promise<void> => {
  autosaveState.saving = true

  try {
    await submitOpenUpdateTransactionAndWait(
      systemSettingsCollection.id,
      SYSTEM_SETTINGS_ID
    )
  } finally {
    autosaveState.saving = false
  }
}

export const flushSystemSettingsAutosave = async (): Promise<void> => {
  await saveSystemSettingsDraftNow()
}
