import { ipcMain } from 'electron'
import type {
  TanstackMutationWireRequest,
  TanstackSystemSettingsRevisionData,
  TanstackUpdateSystemSettingsRevisionRequest,
  TanstackUpdateSystemSettingsRevisionResult
} from '@shared/tanstack/TanstackSystemSettingsRevision'
import { TANSTACK_SYSTEM_SETTINGS_ID } from '@shared/tanstack/TanstackSystemSettings'
import { TanstackSystemSettingsDataAccess } from '../DataAccess/TanstackSystemSettingsDataAccess'
import { runTanstackIpcRequest } from '../IpcFramework/TanstackIpcRequest'
import { tanstackRevisions } from '../Registries/TanstackRevisions'

const buildRevisionPayload = (
  data: TanstackSystemSettingsRevisionData['data'],
  revision: number
): TanstackSystemSettingsRevisionData => ({
  id: TANSTACK_SYSTEM_SETTINGS_ID,
  revision,
  data
})

export const setupTanstackSystemSettingsMutationHandlers = (): void => {
  ipcMain.handle(
    'tanstack-update-system-settings',
    async (
      _,
      request: TanstackMutationWireRequest<TanstackUpdateSystemSettingsRevisionRequest>
    ): Promise<TanstackUpdateSystemSettingsRevisionResult> => {
      return runTanstackIpcRequest(request, async (payload) => {
        try {
          const currentRevision = tanstackRevisions.systemSettings.get(TANSTACK_SYSTEM_SETTINGS_ID)
          const systemSettingsEntity = payload.systemSettings

          if (systemSettingsEntity.expectedRevision !== currentRevision) {
            const settings = await TanstackSystemSettingsDataAccess.loadSystemSettings()
            return {
              success: false,
              conflict: true,
              payload: {
                systemSettings: buildRevisionPayload(settings, currentRevision)
              }
            }
          }

          const settings = await TanstackSystemSettingsDataAccess.updateSystemSettings(
            systemSettingsEntity.data
          )
          const revision = tanstackRevisions.systemSettings.bump(TANSTACK_SYSTEM_SETTINGS_ID)

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
