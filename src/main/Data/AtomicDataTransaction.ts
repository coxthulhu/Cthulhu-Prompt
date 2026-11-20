import { data, type RevisionData } from './Data'
import type { DomainTransitionProjection } from './DomainTransitions'
import { enqueueGlobalMutation } from './GlobalMutationQueue'
import { SqliteDataAccess } from '../Persistence/sqlite/SqliteDataAccess'

/** Commits every projected change across the attached content and machine databases before publishing revisions. */
export const runAtomicDomainTransitionTransaction = async (
  projection: DomainTransitionProjection, options: { mode?: 'queued' | 'immediate' } = {}
): Promise<{ status: 'success' | 'conflict' }> => {
  /** SQLite commands are synchronous, including rollback if any entity fails. */
  const commit = (): { status: 'success' | 'conflict' } => {
    /** The planner supplies the complete ordered batch. */
    const changes = projection.transitions
    for (const { entityType, id, before, after, expectedRevision } of changes) {
      /** Check revisions against the last committed state before writing. */
      const entry = data[entityType].committedStore.getEntry(id)
      if (!entry && !before && !after && data[entityType].targetPolicy === 'deleteIfPresent') continue
      if (Boolean(entry) !== Boolean(before) || (expectedRevision !== undefined && expectedRevision !== (entry?.revision ?? 0))) {
        return { status: 'conflict' }
      }
    }
    SqliteDataAccess.runTransaction(() => {
      for (const { entityType, id, before, after } of changes) {
        /** The entity owns its SQLite write on the shared transaction. */
        const store = data[entityType] as RevisionData<any, Record<string, never>>
        store.persistence.command(id, {
          before: before && { data: before.data, persistenceFields: {} },
          after: after && { data: after.data, persistenceFields: {} }
        })
      }
    })
    for (const { entityType, id, after, before } of changes) {
      /** Publish the new revision only after SQLite commits the entire batch. */
      const store = data[entityType] as RevisionData<any, Record<string, never>>
      if (after) {
        if (!before) store.committedStore.setFromDisk(id, after.data, {})
        store.committedStore.commitAfterWrite(id, after.data)
      } else store.committedStore.remove(id)
      store.emitCommittedRevisionChanged(id)
    }
    return { status: 'success' }
  }
  return options.mode === 'immediate' ? commit() : enqueueGlobalMutation(async () => commit())
}
