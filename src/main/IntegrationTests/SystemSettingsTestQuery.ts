import { ipcMain } from 'electron'
import type { LoadSystemSettingsResult } from '@shared/SystemSettings'
import { SystemSettingsDataAccess } from '../DataAccess/SystemSettingsDataAccess'

export const setupIntegrationTestSystemSettingsQueryHandlers = (): void => {
  ipcMain.handle(
    'load-system-settings-playwright-test',
    async (): Promise<LoadSystemSettingsResult> => {
      try {
        const settings = await SystemSettingsDataAccess.loadSystemSettings()
        return { success: true, settings }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        return { success: false, error: message || 'Failed to load system settings' }
      }
    }
  )
}
