import { createCollection, createTransaction } from '@tanstack/svelte-db'
import type {
  TanstackLoadSystemSettingsSuccess,
  TanstackSystemSettings,
  TanstackSystemSettingsSnapshot,
  TanstackSystemSettingsRecord,
} from '@shared/tanstack/TanstackSystemSettings'
import type {
  TanstackUpdateSystemSettingsRevisionRequest,
  TanstackUpdateSystemSettingsRevisionResult
} from '@shared/tanstack/TanstackSystemSettingsRevision'
import { ipcInvoke } from '@renderer/api/ipcInvoke'
import { enqueueTanstackGlobalMutation } from './TanstackGlobalMutationQueue'
import { tanstackRevisionCollectionOptions } from './TanstackRevisionCollection'

const SYSTEM_SETTINGS_RECORD_ID = 'system-settings'

export const tanstackSystemSettingsCollection = createCollection(
  tanstackRevisionCollectionOptions<TanstackSystemSettingsRecord, string>({
    id: 'tanstack-system-settings',
    getKey: (item) => item.id
  })
)

const toSystemSettingsRecord = (
  snapshot: TanstackSystemSettingsSnapshot
): TanstackSystemSettingsRecord => ({
  id: SYSTEM_SETTINGS_RECORD_ID,
  revision: snapshot.revision,
  ...snapshot.settings
})

const applyAuthoritativeSettings = (snapshot: TanstackSystemSettingsSnapshot): void => {
  const record = toSystemSettingsRecord(snapshot)
  tanstackSystemSettingsCollection.utils.upsertAuthoritative(record)
}

export const setTanstackSystemSettings = (snapshot: TanstackSystemSettingsSnapshot): void => {
  applyAuthoritativeSettings(snapshot)
}

export const getTanstackSystemSettingsRecord = (): TanstackSystemSettingsRecord | null => {
  return tanstackSystemSettingsCollection.get(SYSTEM_SETTINGS_RECORD_ID) ?? null
}

export const refetchTanstackSystemSettings = async (): Promise<void> => {
  const result = await ipcInvoke<TanstackLoadSystemSettingsSuccess>('tanstack-load-system-settings')
  applyAuthoritativeSettings({
    settings: result.settings,
    revision: tanstackSystemSettingsCollection.utils.getAuthoritativeRevision(
      SYSTEM_SETTINGS_RECORD_ID
    )
  })
}

export const updateTanstackSystemSettings = async (
  settings: TanstackSystemSettings
): Promise<TanstackSystemSettingsSnapshot> => {
  let committedSnapshot: TanstackSystemSettingsSnapshot | null = null

  const transaction = createTransaction<TanstackSystemSettingsRecord>({
    autoCommit: false,
    mutationFn: async () => {
      const expectedRevision = tanstackSystemSettingsCollection.utils.getAuthoritativeRevision(
        SYSTEM_SETTINGS_RECORD_ID
      )

      const result = await ipcInvoke<
        TanstackUpdateSystemSettingsRevisionResult,
        TanstackUpdateSystemSettingsRevisionRequest
      >('tanstack-update-system-settings-revision', {
        requestId: crypto.randomUUID(),
        payload: {
          settings,
          expectedRevision
        }
      })

      if (result.success) {
        committedSnapshot = result.payload
        applyAuthoritativeSettings(result.payload)
        return
      }

      if (result.conflict) {
        applyAuthoritativeSettings(result.payload)
        throw new Error('System settings update conflict')
      }
    }
  })

  transaction.mutate(() => {
    tanstackSystemSettingsCollection.update(SYSTEM_SETTINGS_RECORD_ID, (draft) => {
      draft.promptFontSize = settings.promptFontSize
      draft.promptEditorMinLines = settings.promptEditorMinLines
    })
  })

  await enqueueTanstackGlobalMutation(async () => {
    if (transaction.state !== 'pending') {
      return
    }

    await transaction.commit()
  })

  if (transaction.state === 'failed') {
    throw transaction.error?.error ?? new Error('System settings mutation was canceled')
  }

  await transaction.isPersisted.promise

  return committedSnapshot!
}
