import { SYSTEM_SETTINGS_ID, type SystemSettings } from '@shared/SystemSettings'
import type { Transaction } from '@tanstack/svelte-db'
import { AUTOSAVE_MS } from '@renderer/data/draftAutosave'
import {
  SYSTEM_SETTINGS_DRAFT_ID,
  type SystemSettingsDraftRecord,
  systemSettingsDraftCollection
} from '../Collections/SystemSettingsDraftCollection'
import { systemSettingsCollection } from '../Collections/SystemSettingsCollection'
import { submitOpenUpdateTransactionAndWait } from '../IpcFramework/RevisionCollections'
import { getLatestMutationModifiedRecord } from '../IpcFramework/RevisionMutationLookup'
import { mutateOpenSystemSettingsAutosaveUpdate } from '../Mutations/SystemSettingsMutations'
import {
  getSystemSettingsValidation,
  normalizePromptEditorMinLinesInput,
  normalizePromptFontSizeInput
} from './SystemSettingsFormat'

export type SystemSettingsAutosaveState = {
  saving: boolean
}

const autosaveState = $state<SystemSettingsAutosaveState>({
  saving: false
})

export const getSystemSettingsDraftRecord = (): SystemSettingsDraftRecord => {
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

const readValidatedSystemSettings = (
  draftRecord: SystemSettingsDraftRecord
): SystemSettings | null => {
  const validation = getSystemSettingsValidation(draftRecord.draftSnapshot)
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

export const mutateSystemSettingsDraftWithAutosave = (
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
      const validatedSettings = readValidatedSystemSettings(draftRecord)
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

export const getSystemSettingsAutosaveState = (): SystemSettingsAutosaveState => {
  return autosaveState
}

export const saveSystemSettingsDraftNow = async (): Promise<void> => {
  autosaveState.saving = true

  try {
    await submitOpenUpdateTransactionAndWait(systemSettingsCollection.id, SYSTEM_SETTINGS_ID)
  } finally {
    autosaveState.saving = false
  }
}

export const flushSystemSettingsAutosave = async (): Promise<void> => {
  await saveSystemSettingsDraftNow()
}
