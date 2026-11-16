import type { AttachedNoteUiState } from '@shared/domain/ui-state/AttachedNoteUiState'
import {
  USER_PERSISTENCE_ID,
  type UserPersistence
} from '@shared/domain/user-persistence/UserPersistence'
import type {
  WorkspaceUiState
} from '@shared/domain/ui-state/UiState'
import { readTabSession, writeTabSession } from './TabSessionPersistence'
import { WorkspaceStateDataAccess } from './WorkspaceStateDataAccess'
import { UserPersistenceDataAccess } from './UserPersistenceDataAccess'
import type { SqlitePersistenceLayer } from '../PersistenceTypes'

/** Empty location metadata used by authoritative records stored directly in SQLite. */
export type SqlitePersistenceFields = Record<string, never>

/** Two workspace-scoped ID components decoded from a composite authoritative key. */
type WorkspaceCompositeKey = {
  workspaceId: string
  localId: string
}

/** Splits a workspace-scoped authoritative key at its first separator. */
const parseWorkspaceCompositeKey = (id: string): WorkspaceCompositeKey => {
  /** Separator between the workspace ID and collection-local ID. */
  const separatorIndex = id.indexOf(':')
  if (separatorIndex <= 0 || separatorIndex === id.length - 1) {
    throw new Error(`Invalid workspace-scoped UI-state ID: ${id}`)
  }
  return {
    workspaceId: id.slice(0, separatorIndex),
    localId: id.slice(separatorIndex + 1)
  }
}

/** SQLite query/command adapter for the singleton user persistence record. */
export const userPersistenceSqlitePersistence: SqlitePersistenceLayer<
  UserPersistence,
  SqlitePersistenceFields
> = {
  kind: 'sqlite',
  query: (id) =>
    id === USER_PERSISTENCE_ID ? UserPersistenceDataAccess.readUserPersistence() : null,
  command: (_id, transition) => {
    if (!transition.after) throw new Error('User persistence cannot be deleted')
    UserPersistenceDataAccess.updateUserPersistence(transition.after.data)
  }
}

/** SQLite adapter for workspace navigation, which follows the user. */
export const workspaceUiStateSqlitePersistence: SqlitePersistenceLayer<WorkspaceUiState, SqlitePersistenceFields> = {
  kind: 'sqlite',
  query: readTabSession,
  command: (workspaceId, transition) => {
    if (transition.after) writeTabSession(transition.after.data)
    else {
      WorkspaceStateDataAccess.delete(workspaceId, 'tab-session-user', null)
      WorkspaceStateDataAccess.delete(workspaceId, 'tab-session-machine', null)
    }
  }
}

/** Stores attachment visibility separately from shared Markdown and machine-local editors. */
export const attachedNoteUiStateSqlitePersistence: SqlitePersistenceLayer<AttachedNoteUiState, SqlitePersistenceFields> = {
  kind: 'sqlite',
  query: (id) => {
    /** Composite identity scopes each preference to its workspace and note. */
    const { workspaceId, localId: noteId } = parseWorkspaceCompositeKey(id)
    /** Missing rows leave the attachment hidden by default. */
    const state = WorkspaceStateDataAccess.read(workspaceId, 'attached-note', noteId)
    return state ? { workspaceId, noteId, ...state } : null
  },
  command: (id, transition) => {
    /** Identity comes from the authoritative target. */
    const { workspaceId, localId: noteId } = parseWorkspaceCompositeKey(id)
    if (transition.after) WorkspaceStateDataAccess.write(workspaceId, 'attached-note', noteId, { visible: transition.after.data.visible })
    else WorkspaceStateDataAccess.delete(workspaceId, 'attached-note', noteId)
  }
}
