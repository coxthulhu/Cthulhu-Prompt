import { ipcMain } from 'electron'
import type {
  TanstackLoadSystemSettingsResult,
  TanstackUpdateSystemSettingsRequest,
  TanstackUpdateSystemSettingsResult
} from '@shared/tanstack/TanstackSystemSettings'
import { SystemSettingsManager } from '../system-settings'
import { revisions } from '../revisions'

export const setupTanstackSystemSettingsHandlers = (): void => {
  ipcMain.handle('tanstack-load-system-settings', async (): Promise<TanstackLoadSystemSettingsResult> => {
    const result = await SystemSettingsManager.loadSystemSettings()

    if (!result.success || !result.settings) {
      return { success: false, error: result.error ?? 'Failed to load system settings' }
    }

    return { success: true, settings: result.settings }
  })

  ipcMain.handle(
    'tanstack-update-system-settings',
    async (_, request: TanstackUpdateSystemSettingsRequest): Promise<TanstackUpdateSystemSettingsResult> => {
      const result = await SystemSettingsManager.updateSystemSettings(
        request.settings,
        revisions.systemSettings.get()
      )

      if ('data' in result && result.data) {
        return { success: true, settings: result.data }
      }

      const message =
        'error' in result && result.error ? result.error : 'Failed to update system settings'
      return { success: false, error: message }
    }
  )
}
