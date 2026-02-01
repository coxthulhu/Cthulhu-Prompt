import { app, ipcMain } from 'electron'
import * as path from 'path'
import { getFs } from '../fs-provider'
import { revisions } from '../revisions'
import type { UpdatedSystemSettings } from '@shared/ipc/updatedTypes'
import { DEFAULT_SYSTEM_SETTINGS } from '@shared/systemSettings'
import type { SystemSettingsFile } from './diskTypes'

const SYSTEM_SETTINGS_FILENAME = 'SystemSettings.json'

type UpdatedLoadSystemSettingsResult =
  | { success: true; data: UpdatedSystemSettings; revision: number }
  | { success: false; error: string }

export const setupUpdatedSystemSettingsHandlers = (): void => {
  ipcMain.handle(
    'updated-load-system-settings',
    async (): Promise<UpdatedLoadSystemSettingsResult> => {
      try {
        const fs = getFs()
        const settingsPath = path.join(app.getPath('userData'), SYSTEM_SETTINGS_FILENAME)
        const settings: UpdatedSystemSettings = fs.existsSync(settingsPath)
          ? (JSON.parse(fs.readFileSync(settingsPath, 'utf8')) as SystemSettingsFile)
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
