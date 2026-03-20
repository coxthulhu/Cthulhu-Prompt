import type { SystemSettings } from '@shared/SystemSettings'
import { app } from 'electron'
import * as path from 'path'
import { DEFAULT_SYSTEM_SETTINGS, normalizeSystemSettings } from '@shared/SystemSettings'
import { getFs } from '../fs-provider'
import { createPersistenceStageResult, type PersistenceLayer } from './PersistenceTypes'
import {
  commitStagedFileChanges,
  createStagedFileRemove,
  createStagedFileUpsert,
  readJsonFile,
  revertStagedFileChanges,
  resolveTempPath,
  writeJsonFile
} from './FilePersistenceHelpers'

export type SystemSettingsPersistenceFields = Record<string, never>

const SYSTEM_SETTINGS_FILENAME = 'SystemSettings.json'

const ensureSettingsDirectory = (): string => {
  const fs = getFs()
  const settingsDirectory = app.getPath('userData')
  fs.mkdirSync(settingsDirectory, { recursive: true })
  return settingsDirectory
}

const resolveTargetPath = (): string => {
  return path.join(ensureSettingsDirectory(), SYSTEM_SETTINGS_FILENAME)
}

export const systemSettingsPersistence: PersistenceLayer<
  SystemSettings,
  SystemSettingsPersistenceFields
> = {
  stageChanges: async (change) => {
    const targetPath = resolveTargetPath()

    if (change.type === 'remove') {
      return createPersistenceStageResult([createStagedFileRemove(targetPath)])
    }

    const tempPath = resolveTempPath(targetPath)
    const normalizedSettings = normalizeSystemSettings({
      promptFontSize: change.data.promptFontSize,
      promptEditorMinLines: change.data.promptEditorMinLines
    })
    writeJsonFile(tempPath, normalizedSettings)

    return createPersistenceStageResult([createStagedFileUpsert(targetPath, tempPath)])
  },
  commitChanges: async (stagedChange) => {
    commitStagedFileChanges(stagedChange)
  },
  revertChanges: async (stagedChange) => {
    revertStagedFileChanges(stagedChange)
  },
  loadData: async (_persistenceFields) => {
    const fs = getFs()
    const settingsPath = resolveTargetPath()

    if (!fs.existsSync(settingsPath)) {
      writeJsonFile(settingsPath, DEFAULT_SYSTEM_SETTINGS)
      return DEFAULT_SYSTEM_SETTINGS
    }

    try {
      const parsed = readJsonFile<unknown>(settingsPath)
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        writeJsonFile(settingsPath, DEFAULT_SYSTEM_SETTINGS)
        return DEFAULT_SYSTEM_SETTINGS
      }

      return normalizeSystemSettings(parsed as Record<string, unknown>)
    } catch {
      writeJsonFile(settingsPath, DEFAULT_SYSTEM_SETTINGS)
      return DEFAULT_SYSTEM_SETTINGS
    }
  }
}
