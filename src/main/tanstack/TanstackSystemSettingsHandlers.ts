import { ipcMain } from 'electron'
import type {
  TanstackLoadSystemSettingsResult,
  TanstackUpdateSystemSettingsRequest,
  TanstackUpdateSystemSettingsResult
} from '@shared/tanstack/TanstackSystemSettings'
import { TanstackSystemSettingsManager } from './TanstackSystemSettingsManager'

export const setupTanstackSystemSettingsHandlers = (): void => {
  ipcMain.handle('tanstack-load-system-settings', async (): Promise<TanstackLoadSystemSettingsResult> => {
    try {
      const settings = await TanstackSystemSettingsManager.loadSystemSettings()
      return { success: true, settings }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      return { success: false, error: message || 'Failed to load system settings' }
    }
  })

  ipcMain.handle(
    'tanstack-update-system-settings',
    async (_, request: TanstackUpdateSystemSettingsRequest): Promise<TanstackUpdateSystemSettingsResult> => {
      try {
        const settings = await TanstackSystemSettingsManager.updateSystemSettings(request.settings)
        return { success: true, settings }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        return { success: false, error: message || 'Failed to update system settings' }
      }
    }
  )
}
