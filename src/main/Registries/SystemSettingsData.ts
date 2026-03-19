import type { SystemSettings } from '@shared/SystemSettings'
import { createCommittedStore } from './CommittedStore'
import type { RevisionData } from './Data'
import {
  systemSettingsPersistence,
  type SystemSettingsPersistenceFields
} from '../Persistence/SystemSettingsPersistence'
import { createRevisionDataHandlers } from './RevisionDataHandlers'

const committedStore = createCommittedStore<SystemSettings, SystemSettingsPersistenceFields>()

const emitCommittedRevisionChanged = (_id: string): void => {
  // TODO: Emit committed system settings update events.
}

const { loadDataFromPersistence, changeDataAndPersist } = createRevisionDataHandlers({
  committedStore,
  persistence: systemSettingsPersistence,
  emitCommittedRevisionChanged
})

export const systemSettingsData: RevisionData<SystemSettings, SystemSettingsPersistenceFields> = {
  committedStore,
  changeDataAndPersist,
  loadDataFromPersistence,
  emitCommittedRevisionChanged
}
