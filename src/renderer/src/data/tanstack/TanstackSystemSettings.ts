import type {
  TanstackSystemSettings,
  TanstackSystemSettingsSnapshot
} from '@shared/tanstack/TanstackSystemSettings'
import { TANSTACK_SYSTEM_SETTINGS_ID } from '@shared/tanstack/TanstackSystemSettings'
import type {
  TanstackUpdateSystemSettingsRevisionRequest,
  TanstackUpdateSystemSettingsRevisionResult
} from '@shared/tanstack/TanstackSystemSettingsRevision'
import { runTanstackRevisionMutation } from './TanstackRevisionCollections'
import { tanstackSystemSettingsCollection } from './TanstackSystemSettingsCollection'

export { tanstackSystemSettingsCollection } from './TanstackSystemSettingsCollection'

export const applyTanstackSystemSettingsSnapshot = (
  snapshot: TanstackSystemSettingsSnapshot
): void => {
  tanstackSystemSettingsCollection.utils.upsertAuthoritative({
    id: TANSTACK_SYSTEM_SETTINGS_ID,
    revision: snapshot.revision,
    data: snapshot.settings
  })
}

export const getTanstackSystemSettings = (): TanstackSystemSettings | null => {
  return tanstackSystemSettingsCollection.get(TANSTACK_SYSTEM_SETTINGS_ID) ?? null
}

export const updateTanstackSystemSettings = async (
  settings: TanstackSystemSettings
): Promise<void> => {
  await runTanstackRevisionMutation({
    mutateOptimistically: () => {
      tanstackSystemSettingsCollection.update(TANSTACK_SYSTEM_SETTINGS_ID, (draft) => {
        draft.promptFontSize = settings.promptFontSize
        draft.promptEditorMinLines = settings.promptEditorMinLines
      })
    },
    runMutation: async ({ entities, invoke }) => {
      return invoke<TanstackUpdateSystemSettingsRevisionResult, TanstackUpdateSystemSettingsRevisionRequest>(
        'tanstack-update-system-settings-revision',
        {
          payload: {
            systemSettings: entities.systemSettings({
              id: TANSTACK_SYSTEM_SETTINGS_ID,
              data: settings
            })
          }
        }
      )
    },
    conflictMessage: 'System settings update conflict'
  })
}
