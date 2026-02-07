import { createCollection } from '@tanstack/svelte-db'
import type {
  TanstackSystemSettings,
  TanstackSystemSettingsSnapshot,
  TanstackSystemSettingsRecord
} from '@shared/tanstack/TanstackSystemSettings'
import type {
  TanstackUpdateSystemSettingsRevisionRequest,
  TanstackUpdateSystemSettingsRevisionResult
} from '@shared/tanstack/TanstackSystemSettingsRevision'
import { runTanstackRevisionMutation } from './TanstackRevisionMutation'
import { tanstackRevisionCollectionOptions } from './TanstackRevisionCollection'

const SYSTEM_SETTINGS_RECORD_ID = 'system-settings'

export const tanstackSystemSettingsCollection = createCollection(
  tanstackRevisionCollectionOptions<TanstackSystemSettingsRecord, string>({
    id: 'tanstack-system-settings',
    getKey: () => SYSTEM_SETTINGS_RECORD_ID
  })
)

export const applyTanstackSystemSettingsSnapshot = (
  snapshot: TanstackSystemSettingsSnapshot
): void => {
  tanstackSystemSettingsCollection.utils.upsertAuthoritative({
    id: SYSTEM_SETTINGS_RECORD_ID,
    revision: snapshot.revision,
    data: snapshot.settings
  })
}

export const getTanstackSystemSettingsRecord = (): TanstackSystemSettingsRecord | null => {
  return tanstackSystemSettingsCollection.get(SYSTEM_SETTINGS_RECORD_ID) ?? null
}

export const updateTanstackSystemSettings = async (
  settings: TanstackSystemSettings
): Promise<void> => {
  await runTanstackRevisionMutation({
    collections: {
      systemSettings: tanstackSystemSettingsCollection
    },
    mutateOptimistically: () => {
      tanstackSystemSettingsCollection.update(SYSTEM_SETTINGS_RECORD_ID, (draft) => {
        draft.promptFontSize = settings.promptFontSize
        draft.promptEditorMinLines = settings.promptEditorMinLines
      })
    },
    runMutation: async ({ entity, invoke }) => {
      return invoke<TanstackUpdateSystemSettingsRevisionResult, TanstackUpdateSystemSettingsRevisionRequest>(
        'tanstack-update-system-settings-revision',
        {
          requestId: crypto.randomUUID(),
          payload: {
            systemSettings: entity.systemSettings({
              id: SYSTEM_SETTINGS_RECORD_ID,
              data: settings
            })
          }
        }
      )
    },
    conflictMessage: 'System settings update conflict'
  })
}
