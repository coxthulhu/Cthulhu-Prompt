import type { MarkdownContentUiState } from '@shared/MarkdownContentUiState'
import { SqliteDataAccess } from './SqliteDataAccess'

type MarkdownContentUiStateRow = {
  workspaceId: string
  contentId: string
  editorViewStateJson: string
}

export class MarkdownContentUiStateDataAccess {
  static readMarkdownContentUiState(
    workspaceId: string,
    contentId: string
  ): MarkdownContentUiState | null {
    const row = SqliteDataAccess.getDatabase()
      .prepare(
        `
        SELECT
          workspace_id AS workspaceId,
          content_id AS contentId,
          editor_view_state_json AS editorViewStateJson
        FROM markdown_content_ui_state
        WHERE workspace_id = ? AND content_id = ?
        `
      )
      .get(workspaceId, contentId) as MarkdownContentUiStateRow | undefined

    return row
      ? {
          workspaceId: row.workspaceId,
          contentId: row.contentId,
          editorViewStateJson: row.editorViewStateJson
        }
      : null
  }

  static readMarkdownContentUiStates(
    workspaceId: string,
    contentIds: string[]
  ): MarkdownContentUiState[] {
    if (contentIds.length === 0) return []

    const placeholders = contentIds.map(() => '?').join(', ')
    const rows = SqliteDataAccess.getDatabase()
      .prepare(
        `
        SELECT
          workspace_id AS workspaceId,
          content_id AS contentId,
          editor_view_state_json AS editorViewStateJson
        FROM markdown_content_ui_state
        WHERE workspace_id = ?
          AND content_id IN (${placeholders})
        `
      )
      .all(workspaceId, ...contentIds) as MarkdownContentUiStateRow[]

    return rows.map((row) => ({
      workspaceId: row.workspaceId,
      contentId: row.contentId,
      editorViewStateJson: row.editorViewStateJson
    }))
  }

  static upsertMarkdownContentUiState(
    uiState: MarkdownContentUiState
  ): MarkdownContentUiState {
    SqliteDataAccess.getDatabase()
      .prepare(
        `
        INSERT INTO markdown_content_ui_state (
          workspace_id,
          content_id,
          editor_view_state_json
        )
        VALUES (?, ?, ?)
        ON CONFLICT(workspace_id, content_id) DO UPDATE SET
          editor_view_state_json = excluded.editor_view_state_json
        `
      )
      .run(uiState.workspaceId, uiState.contentId, uiState.editorViewStateJson)

    return { ...uiState }
  }

  static deleteMarkdownContentUiState(workspaceId: string, contentId: string): void {
    SqliteDataAccess.getDatabase()
      .prepare(
        'DELETE FROM markdown_content_ui_state WHERE workspace_id = ? AND content_id = ?'
      )
      .run(workspaceId, contentId)
  }

  static cleanupWorkspaceMarkdownContentUiState(
    workspaceId: string,
    workspaceContentIds: string[]
  ): void {
    const db = SqliteDataAccess.getDatabase()
    if (workspaceContentIds.length === 0) {
      db.prepare('DELETE FROM markdown_content_ui_state WHERE workspace_id = ?').run(workspaceId)
      return
    }

    const placeholders = workspaceContentIds.map(() => '?').join(', ')
    db.prepare(
      `
      DELETE FROM markdown_content_ui_state
      WHERE workspace_id = ?
        AND content_id NOT IN (${placeholders})
      `
    ).run(workspaceId, ...workspaceContentIds)
  }
}
