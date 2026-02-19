import { ipcMain } from 'electron'
import { SYSTEM_SETTINGS_ID, type LoadSystemSettingsResult } from '@shared/SystemSettings'
import { SystemSettingsDataAccess } from '../DataAccess/SystemSettingsDataAccess'
import { revisions } from '../Registries/Revisions'

export const setupSystemSettingsQueryHandlers = (): void => {
  ipcMain.handle('load-system-settings', async (): Promise<LoadSystemSettingsResult> => {
    try {
      const settings = await SystemSettingsDataAccess.loadSystemSettings()
      return {
        success: true,
        systemSettings: {
          id: SYSTEM_SETTINGS_ID,
          revision: revisions.systemSettings.get(SYSTEM_SETTINGS_ID),
          data: settings
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      return { success: false, error: message || 'Failed to load system settings' }
    }
  })
}
