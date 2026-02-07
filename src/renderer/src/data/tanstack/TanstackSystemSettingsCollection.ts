import { createCollection } from '@tanstack/svelte-db'
import type { TanstackSystemSettingsRecord } from '@shared/tanstack/TanstackSystemSettings'
import { tanstackRevisionCollectionOptions } from './TanstackRevisionCollection'

export const TANSTACK_SYSTEM_SETTINGS_RECORD_ID = 'system-settings'

export const tanstackSystemSettingsCollection = createCollection(
  tanstackRevisionCollectionOptions<TanstackSystemSettingsRecord, string>({
    id: 'tanstack-system-settings',
    getKey: () => TANSTACK_SYSTEM_SETTINGS_RECORD_ID
  })
)
