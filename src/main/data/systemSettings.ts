import { app, ipcMain } from 'electron'
import * as path from 'path'
import { getFs } from '../fs-provider'
import { revisions } from '../revisions'
import type { SystemSettings } from '@shared/ipc'
import { DEFAULT_SYSTEM_SETTINGS } from '@shared/systemSettings'

const SYSTEM_SETTINGS_FILENAME = 'SystemSettings.json'

type UpdatedLoadSystemSettingsResult =
  | { success: true; data: SystemSettings; revision: number }
  | { success: false; error: string }

export const setupUpdatedSystemSettingsHandlers = (): void => {
  ipcMain.handle(
    'updated-load-system-settings',
    async (): Promise<UpdatedLoadSystemSettingsResult> => {
      try {
        const fs = getFs()
        const settingsPath = path.join(app.getPath('userData'), SYSTEM_SETTINGS_FILENAME)
        const settings = fs.existsSync(settingsPath)
          ? (JSON.parse(fs.readFileSync(settingsPath, 'utf8')) as SystemSettings)
          : DEFAULT_SYSTEM_SETTINGS

        return {
          success: true,
          data: settings,
          revision: revisions.systemSettings.get()
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        return { success: false, error: message }
      }
    }
  )
}
