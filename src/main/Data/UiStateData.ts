import {
  attachedNoteUiStateSqlitePersistence,
  userPersistenceSqlitePersistence,
  workspaceUiStateSqlitePersistence
} from '../Persistence/sqlite/UiStateSqlitePersistence'
import { createRevisionData } from './RevisionDataFactory'

/** Placeholder revision notification hook for SQLite-backed authoritative UI state. */
const emitCommittedRevisionChanged = (_id: string): void => {
  // TODO: Emit committed SQLite UI-state update events.
}

/** Authoritative singleton user persistence backed by SQLite. */
export const userPersistenceData = createRevisionData({
  persistence: userPersistenceSqlitePersistence,
  emitCommittedRevisionChanged
})

/** Authoritative workspace-level UI state backed by SQLite. */
export const workspaceUiStateData = createRevisionData({
  persistence: workspaceUiStateSqlitePersistence,
  emitCommittedRevisionChanged,
  targetPolicy: 'deleteIfPresent'
})

/** Optional user preference deleted atomically with its attachment. */
export const attachedNoteUiStateData = createRevisionData({
  persistence: attachedNoteUiStateSqlitePersistence,
  emitCommittedRevisionChanged,
  targetPolicy: 'deleteIfPresent'
})
