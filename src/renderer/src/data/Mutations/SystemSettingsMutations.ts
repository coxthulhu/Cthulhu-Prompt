import {
  SYSTEM_SETTINGS_ID,
  type SystemSettings,
  type SystemSettingsRevisionPayload,
  type SystemSettingsRevisionResponsePayload
} from '@shared/SystemSettings'
import type { Transaction } from '@tanstack/svelte-db'
import type { IpcMutationPayloadResult } from '@shared/IpcResult'
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

const persistSystemSettingsFromTransaction = async ({
  entities,
  invoke,
  transaction
}: {
  entities: {
    systemSettings: (entity: { id: string; data: SystemSettings }) => {
      id: string
      expectedRevision: number
      data: SystemSettings
    }
  }
  invoke: (
    channel: string,
    request: { payload: SystemSettingsRevisionPayload }
  ) => Promise<IpcMutationPayloadResult<SystemSettingsRevisionResponsePayload>>
  transaction: Transaction<any>
}) => {
  const latestSettings = readLatestSystemSettingsFromTransaction(transaction)

  return invoke('update-system-settings', {
    payload: {
      systemSettings: entities.systemSettings({
        id: SYSTEM_SETTINGS_ID,
        data: latestSettings
      })
    }
  })
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
    persistMutations: persistSystemSettingsFromTransaction,
    handleSuccessOrConflictResponse: (payload) => {
      systemSettingsCollection.utils.upsertAuthoritative(payload.systemSettings)
    },
    conflictMessage: 'System settings update conflict'
  })
}
