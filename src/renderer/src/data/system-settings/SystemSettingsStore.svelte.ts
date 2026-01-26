import type {
  SystemSettings,
  UpdateSystemSettingsRequest,
  UpdateSystemSettingsResult
} from '@shared/ipc'
import { DEFAULT_SYSTEM_SETTINGS } from '@shared/systemSettings'
import { getRuntimeConfig } from '@renderer/app/runtimeConfig'
import { ipcInvoke } from '@renderer/api/ipcInvoke'
import {
  applyServerSnapshot,
  createVersionedDataState,
  type VersionedDataState,
  type VersionedSnapshot
} from '@renderer/data/versioned/VersionedDataStore'

export type SystemSettingsDraft = {
  promptFontSizeInput: string
  version: number
}

export type SystemSettingsState = VersionedDataState<SystemSettingsDraft, SystemSettings>

const runtimeConfig = getRuntimeConfig()
const initialSettings = runtimeConfig.systemSettings ?? DEFAULT_SYSTEM_SETTINGS
const initialVersion = runtimeConfig.systemSettingsVersion ?? 0

const createSnapshot = (
  settings: SystemSettings,
  version: number
): VersionedSnapshot<SystemSettings> => ({
  data: settings,
  version
})

const createDraft = (snapshot: VersionedSnapshot<SystemSettings>): SystemSettingsDraft => ({
  promptFontSizeInput: String(snapshot.data.promptFontSize),
  version: snapshot.version
})

const initialSnapshot = createSnapshot(initialSettings, initialVersion)

const systemSettingsState = $state<SystemSettingsState>({
  ...createVersionedDataState<SystemSettingsDraft, SystemSettings>(
    initialSnapshot,
    createDraft(initialSnapshot)
  )
})

export const getSystemSettingsState = (): SystemSettingsState => systemSettingsState

export const setSystemSettingsDraftFontSizeInput = (value: string): void => {
  systemSettingsState.draft.promptFontSizeInput = value
}

export const saveSystemSettings = async (
  settings: SystemSettings,
  draftInputSnapshot: string
): Promise<UpdateSystemSettingsResult> => {
  systemSettingsState.isSaving = true
  systemSettingsState.errorMessage = null

  const baseVersion = systemSettingsState.base.version
  const pendingSnapshot = createSnapshot(settings, baseVersion)
  systemSettingsState.pending = pendingSnapshot

  try {
    const result = await ipcInvoke<UpdateSystemSettingsResult, UpdateSystemSettingsRequest>(
      'update-system-settings',
      {
        settings,
        version: baseVersion
      }
    )

    if (result.success && result.settings && typeof result.version === 'number') {
      const serverSnapshot = createSnapshot(result.settings, result.version)
      systemSettingsState.base = serverSnapshot
      systemSettingsState.pending = null

      if (systemSettingsState.draft.promptFontSizeInput === draftInputSnapshot) {
        systemSettingsState.draft = createDraft(serverSnapshot)
      } else {
        systemSettingsState.draft.version = serverSnapshot.version
      }

      return result
    }

    if (result.conflict && result.settings && typeof result.version === 'number') {
      applyServerSnapshot(
        systemSettingsState,
        createSnapshot(result.settings, result.version),
        createDraft
      )
      return result
    }

    systemSettingsState.pending = null
    return result
  } catch (error) {
    systemSettingsState.errorMessage = error instanceof Error ? error.message : String(error)
    systemSettingsState.pending = null
    throw error
  } finally {
    systemSettingsState.isSaving = false
  }
}
