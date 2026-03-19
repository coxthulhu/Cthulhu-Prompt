import { produce } from 'immer'
import type { PersistenceLayer } from '../Persistence/PersistenceTypes'
import type { CommittedStore } from './CommittedStore'
import type { DataRecipe } from './Data'

type RevisionDataHandlers<TData, TPersistenceFields> = {
  loadDataFromPersistence: (id: string, persistenceFields: TPersistenceFields) => Promise<void>
  changeDataAndPersist: (id: string, recipe: DataRecipe<TData>) => Promise<number | null>
}

export const createRevisionDataHandlers = <TData, TPersistenceFields>(params: {
  committedStore: CommittedStore<TData, TPersistenceFields>
  persistence: PersistenceLayer<TData, TPersistenceFields>
  emitCommittedRevisionChanged: (id: string) => void
}): RevisionDataHandlers<TData, TPersistenceFields> => {
  const { committedStore, persistence, emitCommittedRevisionChanged } = params

  const loadDataFromPersistence = async (
    id: string,
    persistenceFields: TPersistenceFields
  ): Promise<void> => {
    const loadedData = await persistence.loadData(persistenceFields)

    if (!loadedData) {
      return
    }

    committedStore.setFromDisk(id, loadedData, persistenceFields)
  }

  const changeDataAndPersist = async (
    id: string,
    recipe: DataRecipe<TData>
  ): Promise<number | null> => {
    const committedEntry = committedStore.getEntry(id)

    if (!committedEntry) {
      return null
    }

    const nextData = produce(committedEntry.committed, recipe)
    await persistence.persistData(committedEntry.persistenceFields, nextData)
    const nextRevision = committedStore.commitAfterWrite(id, nextData)
    emitCommittedRevisionChanged(id)

    return nextRevision
  }

  return {
    loadDataFromPersistence,
    changeDataAndPersist
  }
}
