import type { PersistenceLayer } from '../Persistence/PersistenceTypes'
import { createCommittedStore } from './CommittedStore'
import type { RevisionData } from './Data'
import { createRevisionDataHandlers } from './RevisionDataHandlers'

export const createRevisionData = <TData, TPersistenceFields, TStagedChange = unknown>(params: {
  persistence: PersistenceLayer<TData, TPersistenceFields, TStagedChange>
  emitCommittedRevisionChanged: (id: string) => void
}): RevisionData<TData, TPersistenceFields, TStagedChange> => {
  const { persistence, emitCommittedRevisionChanged } = params
  const committedStore = createCommittedStore<TData, TPersistenceFields>()
  const { loadDataFromPersistence } = createRevisionDataHandlers({
    committedStore,
    persistence
  })

  return {
    committedStore,
    persistence,
    loadDataFromPersistence,
    emitCommittedRevisionChanged
  }
}
