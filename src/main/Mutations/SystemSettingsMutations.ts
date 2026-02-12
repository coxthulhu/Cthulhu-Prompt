import { ipcMain } from 'electron'
import {
  SYSTEM_SETTINGS_ID,
  type SystemSettingsRevisionResponsePayload,
  type UpdateSystemSettingsRevisionResult
} from '@shared/SystemSettings'
import { SystemSettingsDataAccess } from '../DataAccess/SystemSettingsDataAccess'
import { parseUpdateSystemSettingsRevisionRequest } from '../IpcFramework/IpcValidation'
import { runMutationIpcRequest } from '../IpcFramework/IpcRequest'
import { revisions } from '../Registries/Revisions'

const buildRevisionPayload = (
  data: SystemSettingsRevisionResponsePayload['systemSettings']['data'],
  revision: number
): SystemSettingsRevisionResponsePayload['systemSettings'] => ({
  id: SYSTEM_SETTINGS_ID,
  revision,
  data
})

export const setupSystemSettingsMutationHandlers = (): void => {
  ipcMain.handle(
    'update-system-settings',
    async (
      _,
      request: unknown
    ): Promise<UpdateSystemSettingsRevisionResult> => {
      return await runMutationIpcRequest(request, parseUpdateSystemSettingsRevisionRequest, async (validatedRequest) => {
        try {
          const payload = validatedRequest.payload
          const currentRevision = revisions.systemSettings.get(SYSTEM_SETTINGS_ID)
          const systemSettingsEntity = payload.systemSettings

          if (systemSettingsEntity.expectedRevision !== currentRevision) {
            const settings = await SystemSettingsDataAccess.loadSystemSettings()
            return {
              success: false,
              conflict: true,
              payload: {
                systemSettings: buildRevisionPayload(settings, currentRevision)
              }
            }
          }

          const settings = await SystemSettingsDataAccess.updateSystemSettings(
            systemSettingsEntity.data
          )
          const revision = revisions.systemSettings.bump(SYSTEM_SETTINGS_ID)

          return {
            success: true,
            payload: {
              systemSettings: buildRevisionPayload(settings, revision)
            }
          }
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error)
          return {
            success: false,
            error: message || 'Failed to update system settings'
          }
        }
      })
    }
  )
}
