import {
  SYSTEM_SETTINGS_ID,
  type SystemSettings,
  type SystemSettingsRevisionResponsePayload
} from '@shared/SystemSettings'
import type { Transaction } from '@tanstack/svelte-db'
import {
  SYSTEM_SETTINGS_DRAFT_ID,
  systemSettingsDraftCollection
} from '../Collections/SystemSettingsDraftCollection'
import { systemSettingsCollection } from '../Collections/SystemSettingsCollection'
import { getLatestMutationModifiedRecord } from '../IpcFramework/RevisionMutationLookup'
import { mutatePacedRevisionUpdateTransaction } from '../IpcFramework/RevisionCollections'
import { toSystemSettingsDraftSnapshot } from '../UiState/SystemSettingsFormat'

const readLatestSystemSettingsFromTransaction = (
  transaction: Transaction<any>
): SystemSettings => {
  return getLatestMutationModifiedRecord(
    transaction,
    systemSettingsCollection.id,
    SYSTEM_SETTINGS_ID,
    () => systemSettingsCollection.get(SYSTEM_SETTINGS_ID)!
  )
}

export const updateSystemSettingsDraftSnapshotFromServer = (
  settings: SystemSettings
): void => {
  if (!systemSettingsDraftCollection.get(SYSTEM_SETTINGS_DRAFT_ID)) {
    throw new Error('System settings draft not loaded')
  }

  systemSettingsDraftCollection.update(SYSTEM_SETTINGS_DRAFT_ID, (draftRecord) => {
    draftRecord.draftSnapshot = toSystemSettingsDraftSnapshot(settings)
    draftRecord.saveError = null
  })
}

type PacedSystemSettingsMutationOptions = Parameters<
  typeof mutatePacedRevisionUpdateTransaction<SystemSettingsRevisionResponsePayload>
>[0]

type PacedSystemSettingsUpdateOptions = Pick<
  PacedSystemSettingsMutationOptions,
  'debounceMs' | 'mutateOptimistically' | 'validateBeforeEnqueue'
>

export const mutatePacedSystemSettingsAutosaveUpdate = ({
  debounceMs,
  mutateOptimistically,
  validateBeforeEnqueue
}: PacedSystemSettingsUpdateOptions): void => {
  mutatePacedRevisionUpdateTransaction<SystemSettingsRevisionResponsePayload>({
    collectionId: systemSettingsCollection.id,
    elementId: SYSTEM_SETTINGS_ID,
    debounceMs,
    mutateOptimistically,
    validateBeforeEnqueue,
    persistMutations: async ({ entities, invoke, transaction }) => {
      const latestSettings = readLatestSystemSettingsFromTransaction(transaction)

      return invoke('update-system-settings', {
        payload: {
          systemSettings: entities.systemSettings({
            id: SYSTEM_SETTINGS_ID,
            data: latestSettings
          })
        }
      })
    },
    handleSuccessOrConflictResponse: (payload) => {
      systemSettingsCollection.utils.upsertAuthoritative(payload.systemSettings)
      updateSystemSettingsDraftSnapshotFromServer(payload.systemSettings.data)
    },
    conflictMessage: 'System settings update conflict'
  })
}
