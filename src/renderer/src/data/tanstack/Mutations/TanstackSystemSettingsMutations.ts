import { TANSTACK_SYSTEM_SETTINGS_ID } from '@shared/tanstack/TanstackSystemSettings'
import type { TanstackSystemSettings } from '@shared/tanstack/TanstackSystemSettings'
import type {
  TanstackSystemSettingsRevisionResponsePayload,
  TanstackUpdateSystemSettingsRevisionRequest,
  TanstackUpdateSystemSettingsRevisionResult
} from '@shared/tanstack/TanstackSystemSettingsRevision'
import { tanstackSystemSettingsCollection } from '../Collections/TanstackSystemSettingsCollection'
import { runTanstackRevisionMutation } from '../IpcFramework/TanstackRevisionCollections'

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
        'tanstack-update-system-settings',
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
    handleSuccessOrConflictResponse: (payload: TanstackSystemSettingsRevisionResponsePayload) =>
      tanstackSystemSettingsCollection.utils.upsertAuthoritative(payload.systemSettings),
    conflictMessage: 'System settings update conflict'
  })
}
