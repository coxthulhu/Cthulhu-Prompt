import { createCollection } from '@tanstack/svelte-db'
import {
  TANSTACK_SYSTEM_SETTINGS_ID,
  type TanstackSystemSettings
} from '@shared/tanstack/TanstackSystemSettings'
import { tanstackRevisionCollectionOptions } from './TanstackRevisionCollection'

export const tanstackSystemSettingsCollection = createCollection(
  tanstackRevisionCollectionOptions<TanstackSystemSettings>({
    id: 'tanstack-system-settings',
    getKey: () => TANSTACK_SYSTEM_SETTINGS_ID
  })
)
