import {
  SYSTEM_SETTINGS_ID,
  type SystemSettings,
  type SystemSettingsRevisionResponsePayload
} from '@shared/SystemSettings'
import type { Transaction } from '@tanstack/svelte-db'
import { systemSettingsCollection } from '../Collections/SystemSettingsCollection'
import { getLatestMutationModifiedRecord } from '../IpcFramework/RevisionMutationLookup'
import { mutateOpenRevisionUpdateTransaction } from '../IpcFramework/RevisionCollections'

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

type OpenSystemSettingsUpdateOptions = {
  debounceMs: number
  mutateOptimistically: () => void
  validateBeforeEnqueue?: (transaction: Transaction<any>) => boolean
}

export const mutateOpenSystemSettingsAutosaveUpdate = ({
  debounceMs,
  mutateOptimistically,
  validateBeforeEnqueue
}: OpenSystemSettingsUpdateOptions): void => {
  mutateOpenRevisionUpdateTransaction<SystemSettingsRevisionResponsePayload>({
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
    },
    conflictMessage: 'System settings update conflict'
  })
}
