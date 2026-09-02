import { ipcMain } from 'electron'
import { SYSTEM_SETTINGS_ID, type LoadSystemSettingsResult } from '@shared/SystemSettings'
import { getRequiredSystemSettingsEntry } from '../Data/SystemSettingsData'
import { buildMainAuthoritativeSnapshots } from '../IpcFramework/AuthoritativeSnapshots'

export const setupSystemSettingsQueryHandlers = (): void => {
  ipcMain.handle('load-system-settings', async (): Promise<LoadSystemSettingsResult> => {
    try {
      getRequiredSystemSettingsEntry()
      return {
        success: true,
        snapshots: buildMainAuthoritativeSnapshots([
          { entityType: 'systemSettings', id: SYSTEM_SETTINGS_ID }
        ])
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      return { success: false, error: message || 'Failed to load system settings' }
    }
  })
}
