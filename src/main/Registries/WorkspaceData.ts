import { produce } from 'immer'
import type { Workspace } from '@shared/Workspace'
import { createCommittedStore } from './CommittedStore'
import type { DataRecipe, RevisionData } from './Data'
import {
  workspacePersistence,
  type WorkspacePersistenceFields
} from '../Persistence/WorkspacePersistence'

const committedStore = createCommittedStore<Workspace, WorkspacePersistenceFields>()

const emitCommittedRevisionChanged = (_id: string): void => {
  // TODO: Emit committed workspace update events.
}

const loadDataFromPersistence = async (
  id: string,
  persistenceFields: WorkspacePersistenceFields
): Promise<void> => {
  const loadedData = await workspacePersistence.loadData(persistenceFields)

  if (!loadedData) {
    return
  }

  committedStore.setFromDisk(id, loadedData, persistenceFields)
}

const changeDataAndPersist = async (
  id: string,
  recipe: DataRecipe<Workspace>
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

  await workspacePersistence.persistData(persistenceFields, nextData)
  const nextRevision = committedStore.commitAfterWrite(id, nextData)
  emitCommittedRevisionChanged(id)

  return nextRevision
}

export const workspaceData: RevisionData<Workspace, WorkspacePersistenceFields> = {
  committedStore,
  changeDataAndPersist,
  loadDataFromPersistence,
  emitCommittedRevisionChanged
}
