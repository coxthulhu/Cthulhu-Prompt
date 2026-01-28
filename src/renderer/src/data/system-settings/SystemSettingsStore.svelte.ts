import type {
  SystemSettings,
  UpdateSystemSettingsRequest
} from '@shared/ipc'
import { getRuntimeConfig } from '@renderer/app/runtimeConfig'
import { ipcInvoke } from '@renderer/api/ipcInvoke'
import {
  createRevisionDataStore,
  type RevisionDataState,
  type RevisionMutationResult,
  type RevisionSaveOutcome,
  type RevisionSnapshot
} from '@renderer/data/revisioned/RevisionDataStore'
import { createRevisionMutation } from '@renderer/data/revisioned/GlobalMutationsQueue'
import { formatPromptFontSizeInput } from '@renderer/data/system-settings/systemSettingsFormat'

export type SystemSettingsDraft = {
  promptFontSizeInput: string
}

export type SystemSettingsState = RevisionDataState<SystemSettingsDraft, SystemSettings>

const runtimeConfig = getRuntimeConfig()
const initialSettings = runtimeConfig.systemSettings
const initialRevision = runtimeConfig.systemSettingsRevision

const createSnapshot = (
  settings: SystemSettings,
  revision: number
): RevisionSnapshot<SystemSettings> => ({
  data: settings,
  revision
})

const createDraft = (snapshot: RevisionSnapshot<SystemSettings>): SystemSettingsDraft => ({
  promptFontSizeInput: formatPromptFontSizeInput(snapshot.data.promptFontSize)
})

const isDraftDirty = (
  draft: SystemSettingsDraft,
  snapshot: RevisionSnapshot<SystemSettings>
): boolean => {
  return (
    draft.promptFontSizeInput !==
    formatPromptFontSizeInput(snapshot.data.promptFontSize)
  )
}

const initialSnapshot = createSnapshot(initialSettings, initialRevision)

const systemSettingsStore = createRevisionDataStore<SystemSettingsDraft, SystemSettings>({
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
): Promise<RevisionSaveOutcome> => {
  return createRevisionMutation({
    elements: [{ store: systemSettingsStore, state: systemSettingsState }],
    run: ([revision]) => {
      return ipcInvoke<RevisionMutationResult<SystemSettings>, UpdateSystemSettingsRequest>(
        'update-system-settings',
        {
          settings,
          revision
        }
      )
    },
    onSuccess: (result) => {
      return systemSettingsStore.applySaveSuccess(
        systemSettingsState,
        createSnapshot(result.data, result.revision)
      )
    },
    onConflict: (result) => {
      return systemSettingsStore.applySaveConflict(
        systemSettingsState,
        createSnapshot(result.data, result.revision)
      )
    }
  })
}
