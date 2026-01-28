import type { SystemSettings } from '@shared/ipc'
import { getRuntimeConfig } from '@renderer/app/runtimeConfig'
import { ipcInvoke } from '@renderer/api/ipcInvoke'

import { createUpdatedBaseDataStore } from './UpdatedBaseDataStore.svelte.ts'

type LoadSystemSettingsResult = {
  data: SystemSettings
  revision: number
}

const SYSTEM_SETTINGS_KEY = 'system-settings'

const systemSettingsStore = createUpdatedBaseDataStore<SystemSettings>()

const runtimeConfig = getRuntimeConfig()
// Precache runtime-provided settings so the renderer has a base snapshot at startup.
systemSettingsStore.applyFetch(SYSTEM_SETTINGS_KEY, {
  data: runtimeConfig.systemSettings,
  revision: runtimeConfig.systemSettingsRevision
})

export const getUpdatedSystemSettingsEntry = () =>
  systemSettingsStore.getEntry(SYSTEM_SETTINGS_KEY)

export const fetchUpdatedSystemSettings = (
  data: SystemSettings,
  revision: number
): void => {
  systemSettingsStore.applyFetch(SYSTEM_SETTINGS_KEY, { data, revision })
}

export const syncUpdatedSystemSettings = (
  data: SystemSettings,
  revision: number
): void => {
  systemSettingsStore.applySync(SYSTEM_SETTINGS_KEY, { data, revision })
}

export const refetchUpdatedSystemSettings = async (): Promise<void> => {
  try {
    // TODO: replace with the real system settings IPC channel.
    const result = await ipcInvoke<LoadSystemSettingsResult>('load-system-settings')
    fetchUpdatedSystemSettings(result.data, result.revision)
  } catch (error) {
    console.error('Failed to refetch system settings:', error)
  }
}
