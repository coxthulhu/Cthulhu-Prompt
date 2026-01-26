import type {
  SystemSettings,
  UpdateSystemSettingsRequest,
  UpdateSystemSettingsResult
} from '@shared/ipc'
import { getRuntimeConfig } from '@renderer/app/runtimeConfig'
import { ipcInvoke } from '@renderer/api/ipcInvoke'
import {
  createVersionedDataStore,
  type VersionedDataState,
  type VersionedSaveOutcome,
  type VersionedSnapshot,
  toVersionedSaveResult
} from '@renderer/data/versioned/VersionedDataStore'
import { formatPromptFontSizeInput } from '@renderer/data/system-settings/systemSettingsFormat'

export type SystemSettingsDraft = {
  promptFontSizeInput: string
}

export type SystemSettingsState = VersionedDataState<SystemSettingsDraft, SystemSettings>

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
  promptFontSizeInput: formatPromptFontSizeInput(snapshot.data.promptFontSize)
})

const isDraftDirty = (
  draft: SystemSettingsDraft,
  snapshot: VersionedSnapshot<SystemSettings>
): boolean => {
  return (
    draft.promptFontSizeInput !==
    formatPromptFontSizeInput(snapshot.data.promptFontSize)
  )
}

const initialSnapshot = createSnapshot(initialSettings, initialVersion)

const systemSettingsStore = createVersionedDataStore<SystemSettingsDraft, SystemSettings>({
  createDraft,
  isDraftDirty
})

const systemSettingsState = $state<SystemSettingsState>(
  systemSettingsStore.createState(initialSnapshot)
)

export const getSystemSettingsState = (): SystemSettingsState => systemSettingsState

export const setSystemSettingsDraftFontSizeInput = (value: string): void => {
  if (systemSettingsState.draftSnapshot.promptFontSizeInput === value) return
  systemSettingsState.draftSnapshot.promptFontSizeInput = value
  systemSettingsStore.markDraftChanged(systemSettingsState)
}

export const saveSystemSettings = (
  settings: SystemSettings
): Promise<VersionedSaveOutcome> => {
  const baseVersion = systemSettingsState.baseSnapshot.version
  return systemSettingsStore.saveVersionedData(
    systemSettingsState,
    createSnapshot(settings, baseVersion),
    async () => {
      const result = await ipcInvoke<UpdateSystemSettingsResult, UpdateSystemSettingsRequest>(
        'update-system-settings',
        {
          settings,
          version: baseVersion
        }
      )

      return toVersionedSaveResult(
        result,
        (payload) => ({
          data: payload.settings!,
          version: payload.version!
        }),
        createSnapshot
      )
    }
  )
}
