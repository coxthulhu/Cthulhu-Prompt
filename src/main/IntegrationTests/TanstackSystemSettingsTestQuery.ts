import { ipcMain } from 'electron'
import type { TanstackLoadSystemSettingsResult } from '@shared/tanstack/TanstackSystemSettings'
import { TanstackSystemSettingsDataAccess } from '../tanstack/DataAccess/TanstackSystemSettingsDataAccess'

export const setupIntegrationTestSystemSettingsQueryHandlers = (): void => {
  ipcMain.handle(
    'tanstack-load-system-settings-playwright-test',
    async (): Promise<TanstackLoadSystemSettingsResult> => {
      try {
        const settings = await TanstackSystemSettingsDataAccess.loadSystemSettings()
        return { success: true, settings }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        return { success: false, error: message || 'Failed to load system settings' }
      }
    }
  )
}
