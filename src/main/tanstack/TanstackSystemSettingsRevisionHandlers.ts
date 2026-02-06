import { ipcMain } from 'electron'
import type {
  TanstackSystemSettingsRevisionData,
  TanstackUpdateSystemSettingsRevisionRequest,
  TanstackUpdateSystemSettingsRevisionResult
} from '@shared/tanstack/TanstackSystemSettingsRevision'
import { TanstackSystemSettingsManager } from './TanstackSystemSettingsManager'
import { tanstackRevisions } from './TanstackRevisions'

// Single-row id used to track system settings revisions.
const SYSTEM_SETTINGS_ROW_ID = 'system-settings'

const buildRevisionPayload = (
  settings: TanstackSystemSettingsRevisionData['settings'],
  revision: number
): TanstackSystemSettingsRevisionData => ({
  settings,
  revision
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
        const currentRevision = tanstackRevisions.systemSettings.get(SYSTEM_SETTINGS_ROW_ID)

        if (payload.expectedRevision !== currentRevision) {
          const settings = await TanstackSystemSettingsManager.loadSystemSettings()
          return {
            requestId,
            success: false,
            conflict: true,
            payload: buildRevisionPayload(settings, currentRevision)
          }
        }

        const settings = await TanstackSystemSettingsManager.updateSystemSettings(payload.settings)
        const revision = tanstackRevisions.systemSettings.bump(SYSTEM_SETTINGS_ROW_ID)

        return {
          requestId,
          success: true,
          payload: buildRevisionPayload(settings, revision)
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
