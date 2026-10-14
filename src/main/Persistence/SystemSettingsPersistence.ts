import { app } from 'electron'
import * as path from 'path'
import {
  DEFAULT_SYSTEM_SETTINGS,
  SYSTEM_SETTINGS_ID,
  normalizeSystemSettings,
  type SystemSettings
} from '@shared/domain/settings/SystemSettings'
import { getFs } from '../fs-provider'
import type { SqlitePersistenceLayer } from './PersistenceTypes'
import { readJsonFile } from './FilePersistenceHelpers'
import { SqliteDataAccess } from './sqlite/SqliteDataAccess'
import { WorkspaceStateDataAccess } from './sqlite/WorkspaceStateDataAccess'

/** SQLite settings require no filesystem location metadata. */
export type SystemSettingsPersistenceFields = Record<string, never>

/** Imports legacy settings before hydration; file removal follows a successful database commit. */
export const importLegacySystemSettings = (): void => {
  /** Filesystem provider also isolates migration tests from the host disk. */
  const fs = getFs()
  /** Legacy application-wide settings file, no longer written by the app. */
  const settingsPath = path.join(app.getPath('userData'), 'SystemSettings.json')
  if (!fs.existsSync(settingsPath)) return
  /** Validated legacy object retained until its normalized settings are committed. */
  let parsed: Record<string, unknown>
  try {
    /** The old format is a JSON object; arrays and scalar values are invalid. */
    const value = readJsonFile<unknown>(settingsPath)
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Expected a settings object')
    parsed = value as Record<string, unknown>
  } catch (error) {
    console.warn('Failed to import SystemSettings.json; retaining the file', error)
    return
  }
  SqliteDataAccess.runTransaction(() => {
    // An interrupted file deletion must never replace settings already saved in SQLite.
    if (!WorkspaceStateDataAccess.read(null, 'system-settings', null)) {
      WorkspaceStateDataAccess.write(null, 'system-settings', null, normalizeSystemSettings(parsed))
    }
  })
  try {
    fs.rmSync(settingsPath)
  } catch (error) {
    console.warn('Failed to remove imported SystemSettings.json; removal will be retried on startup', error)
  }
}

/** All system settings follow the user, including editor font size. */
export const systemSettingsPersistence: SqlitePersistenceLayer<SystemSettings, SystemSettingsPersistenceFields> = {
  kind: 'sqlite',
  query: (id) => {
    if (id !== SYSTEM_SETTINGS_ID) return null
    /** Existing SQLite settings take priority over a retained legacy file. */
    const settings = WorkspaceStateDataAccess.read(null, 'system-settings', null)
    if (settings) return normalizeSystemSettings({ ...settings })
    WorkspaceStateDataAccess.write(null, 'system-settings', null, DEFAULT_SYSTEM_SETTINGS)
    return DEFAULT_SYSTEM_SETTINGS
  },
  command: (_id, transition) => {
    if (!transition.after) {
      WorkspaceStateDataAccess.delete(null, 'system-settings', null)
      return
    }
    WorkspaceStateDataAccess.write(null, 'system-settings', null, normalizeSystemSettings({ ...transition.after.data }))
  }
}
