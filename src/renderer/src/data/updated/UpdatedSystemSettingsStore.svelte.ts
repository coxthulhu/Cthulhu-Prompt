import type { UpdatedSystemSettings } from '@shared/ipc/updatedTypes'
import { getRuntimeConfig } from '@renderer/app/runtimeConfig'

import { createBaseDataStore } from './UpdatedBaseDataStore.svelte.ts'

const SYSTEM_SETTINGS_KEY = 'system-settings'

const systemSettingsStore = createBaseDataStore<UpdatedSystemSettings>()

const runtimeConfig = getRuntimeConfig()
// Precache runtime-provided settings so the renderer has a most recent server authoritative snapshot at startup.
systemSettingsStore.mergeAuthoritativeSnapshot(SYSTEM_SETTINGS_KEY, {
  data: runtimeConfig.systemSettings,
  revision: runtimeConfig.systemSettingsRevision
})

export const getSystemSettingsEntry = () =>
  systemSettingsStore.getEntry(SYSTEM_SETTINGS_KEY)

export const applyFetchSystemSettings = (
  data: UpdatedSystemSettings,
  revision: number
): void => {
  systemSettingsStore.mergeAuthoritativeSnapshot(SYSTEM_SETTINGS_KEY, { data, revision })
}

export const mergeAuthoritativeSystemSettingsSnapshot = (
  data: UpdatedSystemSettings,
  revision: number,
  conflict = false
): void => {
  systemSettingsStore.mergeAuthoritativeSnapshot(
    SYSTEM_SETTINGS_KEY,
    { data, revision },
    conflict
  )
}
