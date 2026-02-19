import { createCollection } from '@tanstack/svelte-db'
import { SYSTEM_SETTINGS_ID, type SystemSettings } from '@shared/SystemSettings'
import { revisionCollectionOptions } from './RevisionCollection'

export const systemSettingsCollection = createCollection(
  revisionCollectionOptions<SystemSettings>({
    id: 'system-settings',
    getKey: () => SYSTEM_SETTINGS_ID
  })
)
