import { app } from 'electron'
import * as path from 'path'
import { getFs } from '../../fs-provider'
import {
  DEFAULT_SYSTEM_SETTINGS,
  normalizeTanstackSystemSettings,
  type TanstackSystemSettings
} from '@shared/tanstack/TanstackSystemSettings'
import type { TanstackSystemSettingsFile } from '@shared/tanstack/DiskTypes/TanstackSystemSettingsDiskTypes'

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
  settings: TanstackSystemSettings
  shouldWriteDefaults: boolean
} => {
  const fs = getFs()
  const settingsPath = resolveSystemSettingsPath()

  if (!fs.existsSync(settingsPath)) {
    return {
      payload: {},
      settings: DEFAULT_SYSTEM_SETTINGS,
      shouldWriteDefaults: true
    }
  }

  try {
    const content = fs.readFileSync(settingsPath, 'utf8')
    const parsed = JSON.parse(content) as TanstackSystemSettingsFile
    const payload = parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : {}

    return {
      payload,
      settings: normalizeTanstackSystemSettings(payload),
      shouldWriteDefaults: false
    }
  } catch {
    return {
      payload: {},
      settings: DEFAULT_SYSTEM_SETTINGS,
      shouldWriteDefaults: true
    }
  }
}

const writeSystemSettingsPayload = (payload: Record<string, unknown>): void => {
  const fs = getFs()
  const settingsPath = resolveSystemSettingsPath()
  fs.writeFileSync(settingsPath, JSON.stringify(payload, null, 2), 'utf8')
}

export class TanstackSystemSettingsDataAccess {
  static async loadSystemSettings(): Promise<TanstackSystemSettings> {
    ensureSystemSettingsDirectory()
    const { payload, settings, shouldWriteDefaults } = readSystemSettingsPayload()

    if (shouldWriteDefaults) {
      // Persist normalized defaults when the file is missing or invalid.
      writeSystemSettingsPayload({
        ...payload,
        ...settings
      })
    }

    return settings
  }

  static async updateSystemSettings(
    settingsUpdate: TanstackSystemSettings
  ): Promise<TanstackSystemSettings> {
    ensureSystemSettingsDirectory()
    const { payload } = readSystemSettingsPayload()

    const nextSettings = normalizeTanstackSystemSettings({
      ...payload,
      ...settingsUpdate
    })
    const nextPayload = {
      ...payload,
      ...nextSettings
    }

    writeSystemSettingsPayload(nextPayload)

    return nextSettings
  }
}
