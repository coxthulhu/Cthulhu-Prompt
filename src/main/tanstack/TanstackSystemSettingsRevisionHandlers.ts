import { ipcMain } from 'electron'
import type {
  TanstackSystemSettingsRevisionData,
  TanstackUpdateSystemSettingsRevisionRequest,
  TanstackUpdateSystemSettingsRevisionResult
} from '@shared/tanstack/TanstackSystemSettingsRevision'
import { TANSTACK_SYSTEM_SETTINGS_ID } from '@shared/tanstack/TanstackSystemSettings'
import { TanstackSystemSettingsManager } from './TanstackSystemSettingsManager'
import { tanstackRevisions } from './TanstackRevisions'

const buildRevisionPayload = (
  data: TanstackSystemSettingsRevisionData['data'],
  revision: number
): TanstackSystemSettingsRevisionData => ({
  id: TANSTACK_SYSTEM_SETTINGS_ID,
  revision,
  data
})

export const setupTanstackSystemSettingsRevisionHandlers = (): void => {
  ipcMain.handle(
    'tanstack-update-system-settings-revision',
    async (
      _,
      request: TanstackUpdateSystemSettingsRevisionRequest
    ): Promise<TanstackUpdateSystemSettingsRevisionResult> => {
      const { requestId, payload } = request

      try {
        const currentRevision = tanstackRevisions.systemSettings.get(TANSTACK_SYSTEM_SETTINGS_ID)
        const systemSettingsEntity = payload.systemSettings

        if (systemSettingsEntity.expectedRevision !== currentRevision) {
          const settings = await TanstackSystemSettingsManager.loadSystemSettings()
          return {
            requestId,
            success: false,
            conflict: true,
            payload: {
              systemSettings: buildRevisionPayload(settings, currentRevision)
            }
          }
        }

        const settings = await TanstackSystemSettingsManager.updateSystemSettings(
          systemSettingsEntity.data
        )
        const revision = tanstackRevisions.systemSettings.bump(TANSTACK_SYSTEM_SETTINGS_ID)

        return {
          requestId,
          success: true,
          payload: {
            systemSettings: buildRevisionPayload(settings, revision)
          }
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        return {
          requestId,
          success: false,
          error: message || 'Failed to update system settings'
        }
      }
    }
  )
}
