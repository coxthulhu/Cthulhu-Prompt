import type { SystemSettings } from '@shared/ipc'
import { getRuntimeConfig } from '@renderer/app/runtimeConfig'

import { createUpdatedBaseDataStore } from './UpdatedBaseDataStore.svelte.ts'
import { refetchUpdatedSystemSettings as refetchUpdatedSystemSettingsIpc } from './ipc/systemSettingsIpc'
import { runUpdatedRefetch } from './ipc/updatedIpcHelpers'

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

export const applyFetchUpdatedSystemSettings = (
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

export const refetchUpdatedSystemSettings = (): Promise<void> =>
  runUpdatedRefetch('system settings', async () => {
    const result = await refetchUpdatedSystemSettingsIpc()
    applyFetchUpdatedSystemSettings(result.data, result.revision)
  })
