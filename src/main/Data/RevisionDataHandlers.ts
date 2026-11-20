import type { PersistenceLayer } from '../Persistence/PersistenceTypes'
import type { CommittedStore } from './CommittedStore'

type RevisionDataHandlers<TPersistenceFields> = {
  loadDataFromPersistence: (id: string, persistenceFields: TPersistenceFields) => Promise<void>
}

export const createRevisionDataHandlers = <TData, TPersistenceFields>(params: {
  committedStore: CommittedStore<TData, TPersistenceFields>
  persistence: PersistenceLayer<TData, TPersistenceFields>
}): RevisionDataHandlers<TPersistenceFields> => {
  const { committedStore, persistence } = params

  const loadDataFromPersistence = async (
    id: string,
    persistenceFields: TPersistenceFields
  ): Promise<void> => {
    /** Data loaded through the persistence kind owned by this authoritative collection. */
    const loadedData = persistence.query(id, persistenceFields)

    if (!loadedData) {
      return
    }

    committedStore.setFromDisk(id, loadedData, persistenceFields)
  }

  return {
    loadDataFromPersistence
  }
}
