import { SYSTEM_SETTINGS_ID, type SystemSettings } from '@shared/SystemSettings'
import {
  systemSettingsPersistence,
  type SystemSettingsPersistenceFields
} from '../Persistence/SystemSettingsPersistence'
import type { CommittedEntry } from './CommittedStore'
import { createRevisionData } from './RevisionDataFactory'

const emitCommittedRevisionChanged = (_id: string): void => {
  // TODO: Emit committed system settings update events.
}

export const systemSettingsData = createRevisionData<
  SystemSettings,
  SystemSettingsPersistenceFields
>({
  persistence: systemSettingsPersistence,
  emitCommittedRevisionChanged
})

export const getRequiredSystemSettingsEntry = (): CommittedEntry<
  SystemSettings,
  SystemSettingsPersistenceFields
> => {
  const committedEntry = systemSettingsData.committedStore.getEntry(SYSTEM_SETTINGS_ID)

  if (!committedEntry) {
    throw new Error('System settings data must be loaded before handling IPC requests')
  }

  return committedEntry
}
