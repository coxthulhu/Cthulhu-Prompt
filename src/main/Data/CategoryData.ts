import { contentPersistence } from '../Persistence/sqlite/WorkspaceDatabase'
import { createRevisionData } from './RevisionDataFactory'

/** Placeholder category revision notification hook for future multi-window updates. */
const emitCommittedRevisionChanged = (_id: string): void => {
  // TODO: Emit committed category update events.
}

/** Authoritative in-memory category store backed by category JSON files. */
export const categoryData = createRevisionData({
  persistence: contentPersistence('category'),
  emitCommittedRevisionChanged
})
