import type { SystemSettings } from '@shared/ipc'
import { getRuntimeConfig } from '@renderer/app/runtimeConfig'

import { createBaseDataStore } from './UpdatedBaseDataStore.svelte.ts'

const SYSTEM_SETTINGS_KEY = 'system-settings'

const systemSettingsStore = createBaseDataStore<SystemSettings>()

const runtimeConfig = getRuntimeConfig()
// Precache runtime-provided settings so the renderer has a most recent server authoritative snapshot at startup.
systemSettingsStore.applyFetch(SYSTEM_SETTINGS_KEY, {
  data: runtimeConfig.systemSettings,
  revision: runtimeConfig.systemSettingsRevision
})

export const getSystemSettingsEntry = () =>
  systemSettingsStore.getEntry(SYSTEM_SETTINGS_KEY)

export const applyFetchSystemSettings = (
  data: SystemSettings,
  revision: number
): void => {
  systemSettingsStore.applyFetch(SYSTEM_SETTINGS_KEY, { data, revision })
}
