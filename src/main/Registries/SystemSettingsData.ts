import { produce } from 'immer'
import type { SystemSettings } from '@shared/SystemSettings'
import { createCommittedStore } from './CommittedStore'
import type { DataRecipe, RevisionData } from './Data'
import {
  systemSettingsPersistence,
  type SystemSettingsPersistenceFields
} from '../Persistence/SystemSettingsPersistence'

const committedStore = createCommittedStore<SystemSettings, SystemSettingsPersistenceFields>()

const emitCommittedRevisionChanged = (_id: string): void => {
  // TODO: Emit committed system settings update events.
}

const loadDataFromPersistence = async (
  id: string,
  persistenceFields: SystemSettingsPersistenceFields
): Promise<void> => {
  const loadedData = await systemSettingsPersistence.loadData(persistenceFields)

  if (!loadedData) {
    return
  }

  committedStore.setFromDisk(id, loadedData, persistenceFields)
}

const changeDataAndPersist = async (
  id: string,
  recipe: DataRecipe<SystemSettings>
): Promise<number | null> => {
  const committed = committedStore.getCommitted(id)

  if (!committed) {
    return null
  }

  const nextData = produce(committed, recipe)
  const persistenceFields = committedStore.getPersistenceFields(id)

  if (!persistenceFields) {
    return null
  }

  await systemSettingsPersistence.persistData(persistenceFields, nextData)
  const nextRevision = committedStore.commitAfterWrite(id, nextData)
  emitCommittedRevisionChanged(id)

  return nextRevision
}

export const systemSettingsData: RevisionData<SystemSettings, SystemSettingsPersistenceFields> = {
  committedStore,
  changeDataAndPersist,
  loadDataFromPersistence,
  emitCommittedRevisionChanged
}
