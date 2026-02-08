import { ipcMain } from 'electron'
import type {
  TanstackLoadSystemSettingsResult
} from '@shared/tanstack/TanstackSystemSettings'
import { TanstackSystemSettingsManager } from './TanstackSystemSettingsManager'

export const setupTanstackSystemSettingsHandlers = (): void => {
  ipcMain.handle(
    'tanstack-load-system-settings-test',
    async (): Promise<TanstackLoadSystemSettingsResult> => {
      try {
        const settings = await TanstackSystemSettingsManager.loadSystemSettings()
        return { success: true, settings }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        return { success: false, error: message || 'Failed to load system settings' }
      }
    }
  )
}
