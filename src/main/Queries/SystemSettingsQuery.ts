import { ipcMain } from 'electron'
import { SYSTEM_SETTINGS_ID, type LoadSystemSettingsResult } from '@shared/SystemSettings'
import { getRequiredSystemSettingsEntry } from '../Data/SystemSettingsData'

export const setupSystemSettingsQueryHandlers = (): void => {
  ipcMain.handle('load-system-settings', async (): Promise<LoadSystemSettingsResult> => {
    try {
      const settingsEntry = getRequiredSystemSettingsEntry()
      return {
        success: true,
        systemSettings: {
          id: SYSTEM_SETTINGS_ID,
          revision: settingsEntry.revision,
          data: settingsEntry.committed
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      return { success: false, error: message || 'Failed to load system settings' }
    }
  })
}
