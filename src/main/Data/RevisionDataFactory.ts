import type { PersistenceLayer } from '../Persistence/PersistenceTypes'
import { createCommittedStore } from './CommittedStore'
import type { RevisionData } from './Data'
import { createRevisionDataHandlers } from './RevisionDataHandlers'

export const createRevisionData = <TData, TPersistenceFields>(params: {
  persistence: PersistenceLayer<TData, TPersistenceFields>
  emitCommittedRevisionChanged: (id: string) => void
}): RevisionData<TData, TPersistenceFields> => {
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
