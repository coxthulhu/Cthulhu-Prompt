import { SYSTEM_SETTINGS_ID } from '@shared/SystemSettings'
import type { SystemSettings } from '@shared/SystemSettings'
import type {
  SystemSettingsRevisionResponsePayload,
  UpdateSystemSettingsRevisionRequest,
  UpdateSystemSettingsRevisionResult
} from '@shared/SystemSettingsRevision'
import { systemSettingsCollection } from '../Collections/SystemSettingsCollection'
import { runRevisionMutation } from '../IpcFramework/RevisionCollections'

export const updateSystemSettings = async (
  settings: SystemSettings
): Promise<void> => {
  await runRevisionMutation({
    mutateOptimistically: () => {
      systemSettingsCollection.update(SYSTEM_SETTINGS_ID, (draft) => {
        draft.promptFontSize = settings.promptFontSize
        draft.promptEditorMinLines = settings.promptEditorMinLines
      })
    },
    runMutation: async ({ entities, invoke }) => {
      return invoke<UpdateSystemSettingsRevisionResult, UpdateSystemSettingsRevisionRequest>(
        'update-system-settings',
        {
          payload: {
            systemSettings: entities.systemSettings({
              id: SYSTEM_SETTINGS_ID,
              data: settings
            })
          }
        }
      )
    },
    handleSuccessOrConflictResponse: (payload: SystemSettingsRevisionResponsePayload) =>
      systemSettingsCollection.utils.upsertAuthoritative(payload.systemSettings),
    conflictMessage: 'System settings update conflict'
  })
}
