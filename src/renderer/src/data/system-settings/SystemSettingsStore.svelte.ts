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
  type VersionedSaveResult,
  type VersionedSnapshot
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
  if (systemSettingsState.draft.promptFontSizeInput === value) return
  systemSettingsState.draft.promptFontSizeInput = value
  systemSettingsStore.markDraftUpdated(systemSettingsState)
}

const toSaveResult = (
  result: UpdateSystemSettingsResult
): VersionedSaveResult<SystemSettings> => {
  if (result.success) {
    return {
      type: 'saved',
      snapshot: createSnapshot(result.settings!, result.version!)
    }
  }

  if (result.conflict) {
    return {
      type: 'conflict',
      snapshot: createSnapshot(result.settings!, result.version!)
    }
  }

  return { type: 'error', message: result.error! }
}

export const saveSystemSettings = (
  settings: SystemSettings
): Promise<VersionedSaveOutcome> => {
  const baseVersion = systemSettingsState.base.version
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

      return toSaveResult(result)
    }
  )
}
