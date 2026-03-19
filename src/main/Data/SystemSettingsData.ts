import type { SystemSettings } from '@shared/SystemSettings'
import {
  systemSettingsPersistence,
  type SystemSettingsPersistenceFields
} from '../Persistence/SystemSettingsPersistence'
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
