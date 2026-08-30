import { SYSTEM_SETTINGS_ID, type SystemSettings } from '@shared/SystemSettings'
import type { Transaction } from '@tanstack/svelte-db'
import { useLiveQuery } from '@tanstack/svelte-db'
import { produce } from 'immer'
import { AUTOSAVE_MS } from '@renderer/data/draftAutosave'
import {
  SYSTEM_SETTINGS_CLIENT_STATE_ID,
  type SystemSettingsClientStateRecord,
  systemSettingsClientStateCollection
} from '../Collections/SystemSettingsClientStateCollection'
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

/** Live-query result for system-settings client state. */
type SystemSettingsClientStateQuery = {
  data: SystemSettingsClientStateRecord[]
}

/** Returns the singleton system-settings client-state record. */
export const getSystemSettingsClientStateRecord = (): SystemSettingsClientStateRecord => {
  return systemSettingsClientStateCollection.get(SYSTEM_SETTINGS_CLIENT_STATE_ID)!
}

/** Subscribes to system-settings client state. */
export const useSystemSettingsClientStateQuery = (): SystemSettingsClientStateQuery => {
  return useLiveQuery((query) => {
    return query.from({ systemSettingsClientState: systemSettingsClientStateCollection })
  }) as SystemSettingsClientStateQuery
}

/** Selects the singleton client-state record from a live-query result. */
export const selectSystemSettingsClientStateRecord = (
  records: SystemSettingsClientStateRecord[]
): SystemSettingsClientStateRecord => {
  return (
    records.find((record) => record.id === SYSTEM_SETTINGS_CLIENT_STATE_ID) ??
    getSystemSettingsClientStateRecord()
  )
}

/** Reads the latest system-settings client state from one transaction. */
const getSystemSettingsClientStateFromTransaction = (
  transaction: Transaction<any>
): SystemSettingsClientStateRecord => {
  return getLatestMutationModifiedRecord(
    transaction,
    systemSettingsClientStateCollection.id,
    SYSTEM_SETTINGS_CLIENT_STATE_ID,
    getSystemSettingsClientStateRecord
  )
}

/** Converts valid client state to authoritative system settings. */
const readValidatedSystemSettings = (
  clientState: SystemSettingsClientStateRecord
): SystemSettings | null => {
  const validation = getSystemSettingsValidation(clientState)
  if (validation.fontSizeError || validation.minLinesError || validation.maxLinesError) {
    return null
  }

  return {
    promptFontSize: normalizePromptFontSizeInput(clientState.promptFontSizeInput).rounded,
    promptEditorMinLines: normalizePromptEditorMinLinesInput(clientState.promptEditorMinLinesInput)
      .rounded,
    promptEditorMaxLines: normalizePromptEditorMaxLinesInput(clientState.promptEditorMaxLinesInput)
      .rounded,
    showLineNumbers: clientState.showLineNumbers
  }
}

/** Applies client-state input changes through the paced settings autosave. */
export const mutateSystemSettingsClientStateWithAutosave = (
  applyClientStateUpdate: (clientState: SystemSettingsClientStateRecord) => void
): void => {
  /** Current optimistic form state used as the next edit base. */
  const currentClientState = getSystemSettingsClientStateRecord()
  /** Complete desired form state after applying this input change. */
  const nextClientState = produce(currentClientState, applyClientStateUpdate)
  /** Valid desired settings, or the current settings while form input is invalid. */
  const nextSystemSettings =
    readValidatedSystemSettings(nextClientState) ??
    systemSettingsCollection.get(SYSTEM_SETTINGS_ID)!
  mutatePacedSystemSettingsAutosaveUpdate({
    systemSettings: nextSystemSettings,
    debounceMs: AUTOSAVE_MS,
    mutateClientState: ({ collections }) => {
      collections.systemSettingsClientState.update(
        SYSTEM_SETTINGS_CLIENT_STATE_ID,
        (clientState) => {
          Object.assign(clientState, nextClientState)
        }
      )
    },
    validateBeforeEnqueue: (transaction) => {
      const clientState = getSystemSettingsClientStateFromTransaction(transaction)
      const validatedSettings = readValidatedSystemSettings(clientState)
      if (!validatedSettings) {
        return false
      }

      transaction.mutate(() => {
        systemSettingsClientStateCollection.update(
          SYSTEM_SETTINGS_CLIENT_STATE_ID,
          (nextClientState) => {
            const nextFormData = toSystemSettingsFormData(validatedSettings)
            nextClientState.promptFontSizeInput = nextFormData.promptFontSizeInput
            nextClientState.promptEditorMinLinesInput = nextFormData.promptEditorMinLinesInput
            nextClientState.promptEditorMaxLinesInput = nextFormData.promptEditorMaxLinesInput
            nextClientState.showLineNumbers = nextFormData.showLineNumbers
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
