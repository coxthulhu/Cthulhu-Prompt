import type { PersistenceLayer } from '../Persistence/PersistenceTypes'
import { createCommittedStore } from './CommittedStore'
import type { RevisionData } from './Data'
import { createRevisionDataHandlers } from './RevisionDataHandlers'
import type { DomainTargetPolicy } from '@shared/DomainChanges'

export const createRevisionData = <TData, TPersistenceFields>(params: {
  persistence: PersistenceLayer<TData, TPersistenceFields>
  emitCommittedRevisionChanged: (id: string) => void
  /** Optional missing-target deletion policy; persisted domain entities require presence. */
  targetPolicy?: DomainTargetPolicy
}): RevisionData<TData, TPersistenceFields> => {
  const {
    persistence,
    emitCommittedRevisionChanged,
    targetPolicy = 'requirePresent'
  } = params
  const committedStore = createCommittedStore<TData, TPersistenceFields>()
  const { loadDataFromPersistence } = createRevisionDataHandlers({
    committedStore,
    persistence
  })

  return {
    committedStore,
    persistence,
    loadDataFromPersistence,
    emitCommittedRevisionChanged,
    targetPolicy
  }
}
