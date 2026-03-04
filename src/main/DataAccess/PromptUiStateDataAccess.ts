import type { PromptUiState } from '@shared/PromptUiState'
import { SqliteDataAccess } from './SqliteDataAccess'

type PromptUiStateRow = {
  workspaceId: string
  promptId: string
  editorViewStateJson: string
}

export const createPromptUiStateRevisionKey = (workspaceId: string, promptId: string): string => {
  return `${workspaceId}:${promptId}`
}

export class PromptUiStateDataAccess {
  static readPromptUiState(workspaceId: string, promptId: string): PromptUiState | null {
    const db = SqliteDataAccess.getDatabase()
    const row = db
      .prepare(
        `
        SELECT
          workspace_id AS workspaceId,
          prompt_id AS promptId,
          editor_view_state_json AS editorViewStateJson
        FROM prompt_ui_state
        WHERE workspace_id = ? AND prompt_id = ?
        `
      )
      .get(workspaceId, promptId) as PromptUiStateRow | undefined

    if (!row) {
      return null
    }

    return {
      workspaceId: row.workspaceId,
      promptId: row.promptId,
      editorViewStateJson: row.editorViewStateJson
    }
  }

  static readPromptUiStates(workspaceId: string, promptIds: string[]): PromptUiState[] {
    if (promptIds.length === 0) {
      return []
    }

    const db = SqliteDataAccess.getDatabase()
    const placeholders = promptIds.map(() => '?').join(', ')
    const rows = db
      .prepare(
        `
        SELECT
          workspace_id AS workspaceId,
          prompt_id AS promptId,
          editor_view_state_json AS editorViewStateJson
        FROM prompt_ui_state
        WHERE workspace_id = ?
          AND prompt_id IN (${placeholders})
        `
      )
      .all(workspaceId, ...promptIds) as PromptUiStateRow[]

    return rows.map((row) => ({
      workspaceId: row.workspaceId,
      promptId: row.promptId,
      editorViewStateJson: row.editorViewStateJson
    }))
  }

  static upsertPromptUiState(promptUiState: PromptUiState): PromptUiState {
    const db = SqliteDataAccess.getDatabase()
    const nextPromptUiState: PromptUiState = {
      workspaceId: promptUiState.workspaceId,
      promptId: promptUiState.promptId,
      editorViewStateJson: promptUiState.editorViewStateJson
    }

    db.prepare(
      `
      INSERT INTO prompt_ui_state (
        workspace_id,
        prompt_id,
        editor_view_state_json
      )
      VALUES (?, ?, ?)
      ON CONFLICT(workspace_id, prompt_id) DO UPDATE SET
        editor_view_state_json = excluded.editor_view_state_json
      `
    ).run(
      nextPromptUiState.workspaceId,
      nextPromptUiState.promptId,
      nextPromptUiState.editorViewStateJson
    )

    return nextPromptUiState
  }

  static deletePromptUiState(workspaceId: string, promptId: string): void {
    const db = SqliteDataAccess.getDatabase()
    db.prepare('DELETE FROM prompt_ui_state WHERE workspace_id = ? AND prompt_id = ?').run(
      workspaceId,
      promptId
    )
  }

  static cleanupWorkspacePromptUiState(workspaceId: string, workspacePromptIds: string[]): void {
    const db = SqliteDataAccess.getDatabase()

    if (workspacePromptIds.length === 0) {
      db.prepare('DELETE FROM prompt_ui_state WHERE workspace_id = ?').run(workspaceId)
      return
    }

    const placeholders = workspacePromptIds.map(() => '?').join(', ')
    db.prepare(
      `
      DELETE FROM prompt_ui_state
      WHERE workspace_id = ?
        AND prompt_id NOT IN (${placeholders})
      `
    ).run(workspaceId, ...workspacePromptIds)
  }
}
