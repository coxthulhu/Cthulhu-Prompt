import { app } from 'electron'
import * as path from 'path'
import { getFs } from '../fs-provider'
import type { TanstackSystemSettings } from '@shared/tanstack/TanstackSystemSettings'
import {
  DEFAULT_SYSTEM_SETTINGS,
  MAX_PROMPT_EDITOR_MIN_LINES,
  MAX_PROMPT_FONT_SIZE,
  MIN_PROMPT_EDITOR_MIN_LINES,
  MIN_PROMPT_FONT_SIZE
} from '@shared/tanstack/TanstackSystemSettings'
import type { SystemSettingsFile } from '../data/diskTypes'

const SYSTEM_SETTINGS_FILENAME = 'SystemSettings.json'

const resolveSystemSettingsPath = (): string => {
  return path.join(app.getPath('userData'), SYSTEM_SETTINGS_FILENAME)
}

const ensureSystemSettingsDirectory = (): void => {
  const fs = getFs()
  const settingsDirectory = app.getPath('userData')
  fs.mkdirSync(settingsDirectory, { recursive: true })
}

const clampPromptFontSize = (value: number): number => {
  return Math.min(MAX_PROMPT_FONT_SIZE, Math.max(MIN_PROMPT_FONT_SIZE, value))
}

const resolvePromptFontSize = (value: unknown, fallback: number): number => {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback
  return clampPromptFontSize(Math.round(value))
}

const clampPromptEditorMinLines = (value: number): number => {
  return Math.min(MAX_PROMPT_EDITOR_MIN_LINES, Math.max(MIN_PROMPT_EDITOR_MIN_LINES, value))
}

const resolvePromptEditorMinLines = (value: unknown, fallback: number): number => {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback
  return clampPromptEditorMinLines(Math.round(value))
}

const normalizeSystemSettings = (payload: Record<string, unknown>): TanstackSystemSettings => {
  return {
    promptFontSize: resolvePromptFontSize(
      payload.promptFontSize,
      DEFAULT_SYSTEM_SETTINGS.promptFontSize
    ),
    promptEditorMinLines: resolvePromptEditorMinLines(
      payload.promptEditorMinLines,
      DEFAULT_SYSTEM_SETTINGS.promptEditorMinLines
    )
  }
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
    const parsed = JSON.parse(content) as SystemSettingsFile
    const payload = parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : {}

    return {
      payload,
      settings: normalizeSystemSettings(payload),
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

export class TanstackSystemSettingsManager {
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

    const nextSettings = normalizeSystemSettings({
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
