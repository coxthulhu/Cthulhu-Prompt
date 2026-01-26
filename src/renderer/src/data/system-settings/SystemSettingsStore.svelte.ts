import type {
  SystemSettings,
  UpdateSystemSettingsRequest,
  UpdateSystemSettingsResult
} from '@shared/ipc'
import { getRuntimeConfig } from '@renderer/app/runtimeConfig'
import { ipcInvoke } from '@renderer/api/ipcInvoke'
import {
  applyServerSnapshot,
  applyServerSnapshotBase,
  createVersionedDataState,
  type VersionedDataState,
  type VersionedSnapshot
} from '@renderer/data/versioned/VersionedDataStore'

export type SystemSettingsDraft = {
  promptFontSizeInput: string
}

export type SystemSettingsState = VersionedDataState<SystemSettingsDraft, SystemSettings>
export type SystemSettingsSaveOutcome = 'saved' | 'conflict' | 'unchanged'

const runtimeConfig = getRuntimeConfig()
const initialSettings = runtimeConfig.systemSettings
const initialVersion = runtimeConfig.systemSettingsVersion

const createSnapshot = (
  settings: SystemSettings,
  version: number
): VersionedSnapshot<SystemSettings> => ({
  data: settings,
  version
})

const createDraft = (snapshot: VersionedSnapshot<SystemSettings>): SystemSettingsDraft => ({
  promptFontSizeInput: String(snapshot.data.promptFontSize)
})

const initialSnapshot = createSnapshot(initialSettings, initialVersion)

const systemSettingsState = $state<SystemSettingsState>(
  createVersionedDataState<SystemSettingsDraft, SystemSettings>(
    initialSnapshot,
    createDraft(initialSnapshot)
  )
)

export const getSystemSettingsState = (): SystemSettingsState => systemSettingsState

export const setSystemSettingsDraftFontSizeInput = (value: string): void => {
  systemSettingsState.draft.promptFontSizeInput = value
}

export const saveSystemSettings = async (
  settings: SystemSettings
): Promise<SystemSettingsSaveOutcome> => {
  systemSettingsState.isSaving = true
  systemSettingsState.errorMessage = null

  const baseVersion = systemSettingsState.base.version
  systemSettingsState.pending = createSnapshot(settings, baseVersion)
  const draftInputAtSave = systemSettingsState.draft.promptFontSizeInput
  const expectedDraftInput = String(settings.promptFontSize)

  try {
    const result = await ipcInvoke<UpdateSystemSettingsResult, UpdateSystemSettingsRequest>(
      'update-system-settings',
      {
        settings,
        version: baseVersion
      }
    )

    if (result.success && result.settings) {
      const serverSnapshot = createSnapshot(result.settings, result.version as number)
      if (systemSettingsState.draft.promptFontSizeInput === draftInputAtSave) {
        applyServerSnapshot(systemSettingsState, serverSnapshot, createDraft)
      } else {
        applyServerSnapshotBase(systemSettingsState, serverSnapshot)
      }
      return systemSettingsState.draft.promptFontSizeInput === expectedDraftInput
        ? 'saved'
        : 'unchanged'
    }

    if (result.conflict && result.settings) {
      applyServerSnapshot(
        systemSettingsState,
        createSnapshot(result.settings, result.version as number),
        createDraft
      )
      return 'conflict'
    }

    systemSettingsState.pending = null
    return 'unchanged'
  } catch (error) {
    systemSettingsState.errorMessage = error instanceof Error ? error.message : String(error)
    systemSettingsState.pending = null
    throw error
  } finally {
    systemSettingsState.isSaving = false
  }
}
