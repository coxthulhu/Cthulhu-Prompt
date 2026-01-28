import { app, ipcMain } from 'electron'
import * as path from 'path'
import { getFs } from './fs-provider'
import { revisions } from './revisions'
import type {
  LoadSystemSettingsResult,
  SystemSettings,
  UpdateSystemSettingsRequest,
  UpdateSystemSettingsResult
} from '@shared/ipc'
import { DEFAULT_SYSTEM_SETTINGS, normalizeSystemSettings } from '@shared/systemSettings'

const SYSTEM_SETTINGS_FILENAME = 'SystemSettings.json'

const resolveSystemSettingsPath = (): string => {
  return path.join(app.getPath('userData'), SYSTEM_SETTINGS_FILENAME)
}

const ensureSystemSettingsDirectory = (): void => {
  const fs = getFs()
  const settingsDirectory = app.getPath('userData')
  fs.mkdirSync(settingsDirectory, { recursive: true })
}

const readSystemSettingsPayload = (): {
  payload: Record<string, unknown>
  settings: SystemSettings
  shouldPersist: boolean
} => {
  const fs = getFs()
  const settingsPath = resolveSystemSettingsPath()

  if (!fs.existsSync(settingsPath)) {
    return {
      payload: {},
      settings: DEFAULT_SYSTEM_SETTINGS,
      shouldPersist: true
    }
  }

  try {
    const content = fs.readFileSync(settingsPath, 'utf8')
    const parsed = JSON.parse(content)
    const payload = parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : {}

    return {
      payload,
      settings: normalizeSystemSettings(payload),
      shouldPersist: false
    }
  } catch {
    return {
      payload: {},
      settings: DEFAULT_SYSTEM_SETTINGS,
      shouldPersist: true
    }
  }
}

const writeSystemSettingsPayload = (payload: Record<string, unknown>): void => {
  const fs = getFs()
  const settingsPath = resolveSystemSettingsPath()
  fs.writeFileSync(settingsPath, JSON.stringify(payload, null, 2), 'utf8')
}

export class SystemSettingsManager {
  static setupIpcHandlers(): void {
    ipcMain.handle('load-system-settings', async () => {
      return await this.loadSystemSettings()
    })

    ipcMain.handle(
      'update-system-settings',
      async (_, request: UpdateSystemSettingsRequest) => {
        return await this.updateSystemSettings(request.settings, request.revision)
      }
    )
  }

  static async loadSystemSettings(): Promise<LoadSystemSettingsResult> {
    try {
      ensureSystemSettingsDirectory()
      const { payload, settings, shouldPersist } = readSystemSettingsPayload()

      if (shouldPersist) {
        writeSystemSettingsPayload({
          ...payload,
          ...settings
        })
      }

      return { success: true, settings, revision: revisions.systemSettings.get() }
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  }

  static async updateSystemSettings(
    settingsUpdate: SystemSettings,
    requestRevision: number
  ): Promise<UpdateSystemSettingsResult> {
    try {
      ensureSystemSettingsDirectory()
      const { payload, settings: currentSettings } = readSystemSettingsPayload()

      const currentRevision = revisions.systemSettings.get()

      if (requestRevision !== currentRevision) {
        return {
          success: false,
          conflict: true,
          data: currentSettings,
          revision: currentRevision
        }
      }

      const nextSettings = normalizeSystemSettings({
        ...payload,
        ...settingsUpdate
      })
      const nextPayload = {
        ...payload,
        ...nextSettings
      }

      writeSystemSettingsPayload(nextPayload)
      const nextRevision = revisions.systemSettings.bump()

      return { success: true, data: nextSettings, revision: nextRevision }
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  }
}
