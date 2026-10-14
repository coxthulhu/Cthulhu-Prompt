import type Database from 'better-sqlite3'
import { SqliteDataAccess } from './SqliteDataAccess'
import { WORKSPACE_STATE_SCOPES, type WorkspaceStateData, type WorkspaceStateType } from './WorkspaceState'

/** Writes one typed JSON object, including during startup before the database is published. */
export const writeWorkspaceState = <T extends WorkspaceStateType>(
  db: Database.Database,
  workspaceId: string | null,
  stateType: T,
  entityId: string | null,
  data: WorkspaceStateData[T]
): void => {
  db.prepare(`INSERT INTO workspace_state (workspace_id, state_type, entity_id, storage_scope, data_json)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT DO UPDATE SET storage_scope = excluded.storage_scope, data_json = excluded.data_json`)
    .run(workspaceId, stateType, entityId, WORKSPACE_STATE_SCOPES[stateType], JSON.stringify(data))
}

/** Shared JSON storage for application, workspace, and entity state. */
export class WorkspaceStateDataAccess {
  /** Reads a state object using null-safe identity comparisons. */
  static read<T extends WorkspaceStateType>(workspaceId: string | null, stateType: T, entityId: string | null): WorkspaceStateData[T] | null {
    /** Serialized object selected by the full logical key. */
    const row = SqliteDataAccess.getDatabase().prepare(
      'SELECT data_json FROM workspace_state WHERE workspace_id IS ? AND state_type = ? AND entity_id IS ?'
    ).get(workspaceId, stateType, entityId) as { data_json: string } | undefined
    return row ? JSON.parse(row.data_json) : null
  }

  /** Replaces a state object without affecting other types at the same identity. */
  static write<T extends WorkspaceStateType>(workspaceId: string | null, stateType: T, entityId: string | null, data: WorkspaceStateData[T]): void {
    writeWorkspaceState(SqliteDataAccess.getDatabase(), workspaceId, stateType, entityId, data)
  }

  /** Loads requested entity payloads in one query for content hydration. */
  static readMany<T extends WorkspaceStateType>(workspaceId: string, stateType: T, entityIds: string[]): Array<{ entityId: string; data: WorkspaceStateData[T] }> {
    if (entityIds.length === 0) return []
    /** Bound entity parameters retain the existing bulk editor-state loading behavior. */
    const placeholders = entityIds.map(() => '?').join(', ')
    /** Serialized state rows for only the requested content. */
    const rows = SqliteDataAccess.getDatabase().prepare(
      `SELECT entity_id, data_json FROM workspace_state WHERE workspace_id = ? AND state_type = ? AND entity_id IN (${placeholders})`
    ).all(workspaceId, stateType, ...entityIds) as Array<{ entity_id: string; data_json: string }>
    return rows.map((row) => ({ entityId: row.entity_id, data: JSON.parse(row.data_json) }))
  }

  /** Deletes exactly one state type at the supplied identity. */
  static delete(workspaceId: string | null, stateType: WorkspaceStateType, entityId: string | null): void {
    SqliteDataAccess.getDatabase().prepare(
      'DELETE FROM workspace_state WHERE workspace_id IS ? AND state_type = ? AND entity_id IS ?'
    ).run(workspaceId, stateType, entityId)
  }

  /** Lists entity identities for hydration and stale-entity cleanup. */
  static listEntityIds(workspaceId: string, stateType: WorkspaceStateType): string[] {
    /** Entity rows belonging to this workspace and state type. */
    const rows = SqliteDataAccess.getDatabase().prepare(
      'SELECT entity_id FROM workspace_state WHERE workspace_id = ? AND state_type = ? AND entity_id IS NOT NULL'
    ).all(workspaceId, stateType) as Array<{ entity_id: string }>
    return rows.map((row) => row.entity_id)
  }
}
