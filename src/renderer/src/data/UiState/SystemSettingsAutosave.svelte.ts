import { SYSTEM_SETTINGS_ID, type SystemSettings } from '@shared/SystemSettings'
import type { Transaction } from '@tanstack/svelte-db'
import { useLiveQuery } from '@tanstack/svelte-db'
import { AUTOSAVE_MS } from '@renderer/data/draftAutosave'
import {
  SYSTEM_SETTINGS_FORM_DATA_ID,
  type SystemSettingsFormDataRecord,
  systemSettingsFormDataCollection
} from '../Collections/SystemSettingsFormDataCollection'
import { systemSettingsCollection } from '../Collections/SystemSettingsCollection'
import { submitPacedUpdateTransactionAndWait } from '../IpcFramework/RevisionCollections'
import { getLatestMutationModifiedRecord } from '../IpcFramework/RevisionMutationLookup'
import { mutatePacedSystemSettingsAutosaveUpdate } from '../Mutations/SystemSettingsMutations'
import {
  getSystemSettingsValidation,
  normalizePromptEditorMaxLinesInput,
  normalizePromptEditorMinLinesInput,
  normalizePromptFontSizeInput,
  toSystemSettingsFormData
} from './SystemSettingsFormat'

type SystemSettingsAutosaveState = {
  saving: boolean
}

const autosaveState = $state<SystemSettingsAutosaveState>({
  saving: false
})

type SystemSettingsFormDataQuery = {
  data: SystemSettingsFormDataRecord[]
}

export const getSystemSettingsFormDataRecord = (): SystemSettingsFormDataRecord => {
  return systemSettingsFormDataCollection.get(SYSTEM_SETTINGS_FORM_DATA_ID)!
}

export const useSystemSettingsFormDataQuery = (): SystemSettingsFormDataQuery => {
  return useLiveQuery((query) => {
    return query.from({ systemSettingsFormData: systemSettingsFormDataCollection })
  }) as SystemSettingsFormDataQuery
}

export const selectSystemSettingsFormDataRecord = (
  records: SystemSettingsFormDataRecord[]
): SystemSettingsFormDataRecord => {
  return (
    records.find((record) => record.id === SYSTEM_SETTINGS_FORM_DATA_ID) ??
    getSystemSettingsFormDataRecord()
  )
}

const getSystemSettingsFormDataRecordFromTransaction = (
  transaction: Transaction<any>
): SystemSettingsFormDataRecord => {
  return getLatestMutationModifiedRecord(
    transaction,
    systemSettingsFormDataCollection.id,
    SYSTEM_SETTINGS_FORM_DATA_ID,
    getSystemSettingsFormDataRecord
  )
}

const readValidatedSystemSettings = (
  formDataRecord: SystemSettingsFormDataRecord
): SystemSettings | null => {
  const validation = getSystemSettingsValidation(formDataRecord)
  if (validation.fontSizeError || validation.minLinesError || validation.maxLinesError) {
    return null
  }

  return {
    promptFontSize: normalizePromptFontSizeInput(formDataRecord.promptFontSizeInput).rounded,
    promptEditorMinLines: normalizePromptEditorMinLinesInput(formDataRecord.promptEditorMinLinesInput)
      .rounded,
    promptEditorMaxLines: normalizePromptEditorMaxLinesInput(formDataRecord.promptEditorMaxLinesInput)
      .rounded,
    showLineNumbers: formDataRecord.showLineNumbers
  }
}

export const mutateSystemSettingsFormDataWithAutosave = (
  applyFormDataUpdate: (formDataRecord: SystemSettingsFormDataRecord) => void
): void => {
  mutatePacedSystemSettingsAutosaveUpdate({
    debounceMs: AUTOSAVE_MS,
    mutateOptimistically: ({ collections }) => {
      collections.systemSettingsFormData.update(SYSTEM_SETTINGS_FORM_DATA_ID, (formDataRecord) => {
        applyFormDataUpdate(formDataRecord)
      })
    },
    validateBeforeEnqueue: (transaction) => {
      const formDataRecord = getSystemSettingsFormDataRecordFromTransaction(transaction)
      const validatedSettings = readValidatedSystemSettings(formDataRecord)
      if (!validatedSettings) {
        return false
      }

      transaction.mutate(() => {
        systemSettingsCollection.update(SYSTEM_SETTINGS_ID, (draft) => {
          draft.promptFontSize = validatedSettings.promptFontSize
          draft.promptEditorMinLines = validatedSettings.promptEditorMinLines
          draft.promptEditorMaxLines = validatedSettings.promptEditorMaxLines
          draft.showLineNumbers = validatedSettings.showLineNumbers
        })
        systemSettingsFormDataCollection.update(
          SYSTEM_SETTINGS_FORM_DATA_ID,
          (formDataRecord) => {
            const nextFormData = toSystemSettingsFormData(validatedSettings)
            formDataRecord.promptFontSizeInput = nextFormData.promptFontSizeInput
            formDataRecord.promptEditorMinLinesInput = nextFormData.promptEditorMinLinesInput
            formDataRecord.promptEditorMaxLinesInput = nextFormData.promptEditorMaxLinesInput
            formDataRecord.showLineNumbers = nextFormData.showLineNumbers
          }
        )
      })

      return true
    }
  })
}

export const getSystemSettingsAutosaveState = (): SystemSettingsAutosaveState => {
  return autosaveState
}

export const flushSystemSettingsAutosaves = async (): Promise<void> => {
  autosaveState.saving = true

  try {
    await submitPacedUpdateTransactionAndWait(systemSettingsCollection.id, SYSTEM_SETTINGS_ID)
  } finally {
    autosaveState.saving = false
  }
}
