import type { PersistenceLayer } from '../Persistence/PersistenceTypes'
import type { CommittedStore } from './CommittedStore'

type RevisionDataHandlers<TPersistenceFields> = {
  loadDataFromPersistence: (id: string, persistenceFields: TPersistenceFields) => Promise<void>
}

export const createRevisionDataHandlers = <TData, TPersistenceFields, TStagedChange = unknown>(params: {
  committedStore: CommittedStore<TData, TPersistenceFields>
  persistence: PersistenceLayer<TData, TPersistenceFields, TStagedChange>
}): RevisionDataHandlers<TPersistenceFields> => {
  const { committedStore, persistence } = params

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

  return {
    loadDataFromPersistence
  }
}
