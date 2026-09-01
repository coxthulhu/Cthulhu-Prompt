import {
  accordionUiStateSqlitePersistence,
  categoryDescriptionEditorUiStateSqlitePersistence,
  markdownContentUiStateSqlitePersistence,
  userPersistenceSqlitePersistence,
  workspacePromptFolderUiStateSqlitePersistence,
  workspaceUiStateSqlitePersistence
} from '../Persistence/UiStateSqlitePersistence'
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

/** Authoritative workspace prompt-folder UI state backed by SQLite. */
export const workspacePromptFolderUiStateData = createRevisionData({
  persistence: workspacePromptFolderUiStateSqlitePersistence,
  emitCommittedRevisionChanged,
  targetPolicy: 'deleteIfPresent'
})

/** Authoritative accordion UI state backed by SQLite. */
export const accordionUiStateData = createRevisionData({
  persistence: accordionUiStateSqlitePersistence,
  emitCommittedRevisionChanged,
  targetPolicy: 'deleteIfPresent'
})

/** Authoritative category-description editor UI state backed by SQLite. */
export const categoryDescriptionEditorUiStateData = createRevisionData({
  persistence: categoryDescriptionEditorUiStateSqlitePersistence,
  emitCommittedRevisionChanged,
  targetPolicy: 'deleteIfPresent'
})

/** Authoritative markdown-content editor UI state backed by SQLite. */
export const markdownContentUiStateData = createRevisionData({
  persistence: markdownContentUiStateSqlitePersistence,
  emitCommittedRevisionChanged,
  targetPolicy: 'deleteIfPresent'
})
