import { produce, type Draft } from 'immer'
import type { PersistenceLayer } from '../Persistence/PersistenceTypes'
import type { CommittedStore } from './CommittedStore'

type DataRecipe<TData> = (draft: Draft<TData>) => void

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
    const committed = committedStore.getCommitted(id)

    if (!committed) {
      return null
    }

    const nextData = produce(committed, recipe)
    const persistenceFields = committedStore.getPersistenceFields(id)

    if (!persistenceFields) {
      return null
    }

    await persistence.persistData(persistenceFields, nextData)
    const nextRevision = committedStore.commitAfterWrite(id, nextData)
    emitCommittedRevisionChanged(id)

    return nextRevision
  }

  return {
    loadDataFromPersistence,
    changeDataAndPersist
  }
}
