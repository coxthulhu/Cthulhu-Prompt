import type {
  SystemSettings,
  UpdateSystemSettingsRequest,
  UpdateSystemSettingsResult
} from '@shared/ipc'
import { getRuntimeConfig } from '@renderer/app/runtimeConfig'
import { ipcInvoke } from '@renderer/api/ipcInvoke'
import {
  createVersionedDataState,
  markDraftUpdated,
  saveVersionedData,
  type VersionedDataState,
  type VersionedSaveOutcome,
  type VersionedSaveResult,
  type VersionedSnapshot
} from '@renderer/data/versioned/VersionedDataStore'

export type SystemSettingsDraft = {
  promptFontSizeInput: string
}

export type SystemSettingsState = VersionedDataState<SystemSettingsDraft, SystemSettings>
export type SystemSettingsSaveOutcome = VersionedSaveOutcome

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

const isDraftDirty = (
  draft: SystemSettingsDraft,
  snapshot: VersionedSnapshot<SystemSettings>
): boolean => {
  return draft.promptFontSizeInput !== String(snapshot.data.promptFontSize)
}

const initialSnapshot = createSnapshot(initialSettings, initialVersion)

const systemSettingsState = $state<SystemSettingsState>(
  createVersionedDataState<SystemSettingsDraft, SystemSettings>(
    initialSnapshot,
    createDraft(initialSnapshot),
    isDraftDirty
  )
)

export const getSystemSettingsState = (): SystemSettingsState => systemSettingsState

export const setSystemSettingsDraftFontSizeInput = (value: string): void => {
  if (systemSettingsState.draft.promptFontSizeInput === value) return
  systemSettingsState.draft.promptFontSizeInput = value
  markDraftUpdated(systemSettingsState, isDraftDirty)
}

export const saveSystemSettings = async (
  settings: SystemSettings
): Promise<void> => {
  const baseVersion = systemSettingsState.base.version
  await saveVersionedData(
    systemSettingsState,
    createSnapshot(settings, baseVersion),
    createDraft,
    isDraftDirty,
    async (): Promise<VersionedSaveResult<SystemSettings>> => {
      const result = await ipcInvoke<UpdateSystemSettingsResult, UpdateSystemSettingsRequest>(
        'update-system-settings',
        {
          settings,
          version: baseVersion
        }
      )

      if (result.success && result.settings) {
        return {
          type: 'saved',
          snapshot: createSnapshot(result.settings, result.version as number)
        }
      }

      if (result.conflict && result.settings) {
        return {
          type: 'conflict',
          snapshot: createSnapshot(result.settings, result.version as number)
        }
      }

      return { type: 'error', message: result.error as string }
    }
  )
}
