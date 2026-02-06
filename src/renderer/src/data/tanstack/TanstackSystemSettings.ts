import { createCollection } from '@tanstack/svelte-db'
import type {
  TanstackSystemSettings,
  TanstackSystemSettingsSnapshot,
  TanstackSystemSettingsRecord,
} from '@shared/tanstack/TanstackSystemSettings'
import type {
  TanstackUpdateSystemSettingsRevisionRequest,
  TanstackUpdateSystemSettingsRevisionResult
} from '@shared/tanstack/TanstackSystemSettingsRevision'
import { ipcInvoke } from '@renderer/api/ipcInvoke'
import { runTanstackRevisionMutation } from './TanstackRevisionMutation'
import { tanstackRevisionCollectionOptions } from './TanstackRevisionCollection'

const SYSTEM_SETTINGS_RECORD_ID = 'system-settings'

export const tanstackSystemSettingsCollection = createCollection(
  tanstackRevisionCollectionOptions<TanstackSystemSettingsRecord, string>({
    id: 'tanstack-system-settings',
    getKey: (record) => record.id
  })
)

export const applyTanstackSystemSettingsSnapshot = (
  snapshot: TanstackSystemSettingsSnapshot
): void => {
  tanstackSystemSettingsCollection.utils.upsertAuthoritative({
    id: SYSTEM_SETTINGS_RECORD_ID,
    revision: snapshot.revision,
    ...snapshot.settings
  })
}

export const getTanstackSystemSettingsRecord = (): TanstackSystemSettingsRecord | null => {
  return tanstackSystemSettingsCollection.get(SYSTEM_SETTINGS_RECORD_ID) ?? null
}

export const updateTanstackSystemSettings = async (
  settings: TanstackSystemSettings
): Promise<TanstackSystemSettingsSnapshot> => {
  return runTanstackRevisionMutation<TanstackSystemSettingsRecord, TanstackSystemSettingsSnapshot>({
    getExpectedRevision: () => {
      return tanstackSystemSettingsCollection.utils.getAuthoritativeRevision(SYSTEM_SETTINGS_RECORD_ID)
    },
    mutateOptimistically: () => {
      tanstackSystemSettingsCollection.update(SYSTEM_SETTINGS_RECORD_ID, (draft) => {
        draft.promptFontSize = settings.promptFontSize
        draft.promptEditorMinLines = settings.promptEditorMinLines
      })
    },
    runMutation: async (expectedRevision) => {
      return ipcInvoke<TanstackUpdateSystemSettingsRevisionResult, TanstackUpdateSystemSettingsRevisionRequest>(
        'tanstack-update-system-settings-revision',
        {
          requestId: crypto.randomUUID(),
          payload: {
            settings,
            expectedRevision
          }
        }
      )
    },
    applyAuthoritative: applyTanstackSystemSettingsSnapshot,
    conflictMessage: 'System settings update conflict'
  })
}
