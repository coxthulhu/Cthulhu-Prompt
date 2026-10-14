import type { ElectronApplication } from 'playwright'
import { runSqlStatement, toSqlText } from '../helpers/UserPersistenceHelpers'

/** Recreates the real legacy schema instead of relying on the current schema's tables. */
export const createLegacyStateDatabase = async (
  electronApp: ElectronApplication,
  version: 24 | 25 | 26 = 26,
  workspaceInfoPath: string | null = null
): Promise<void> => {
  for (const sql of [
    'DROP TABLE workspace_state',
    `CREATE TABLE app_persistence (
      id INTEGER PRIMARY KEY, last_workspace_info_path TEXT, app_sidebar_width_px INTEGER NOT NULL,
      window_x_px INTEGER, window_y_px INTEGER, window_width_px INTEGER, window_height_px INTEGER,
      window_is_maximized INTEGER, window_is_fullscreen INTEGER,
      has_shown_welcome INTEGER NOT NULL DEFAULT 0, workspace_dialog_directory TEXT
    )`,
    `CREATE TABLE workspace_ui_state (
      workspace_id TEXT PRIMARY KEY, selected_screen TEXT NOT NULL, selected_screen_data_json TEXT,
      last_prompt_task_collection_id TEXT, last_prompt_template_collection_id TEXT
    )`,
    `CREATE TABLE prompt_collection_view_state (
      workspace_id TEXT NOT NULL, content_owner_id TEXT NOT NULL, selected_entry_id TEXT NOT NULL,
      tree_is_expanded INTEGER NOT NULL DEFAULT 1, content_section_is_expanded INTEGER NOT NULL DEFAULT 1,
      scroll_top_by_mode_json TEXT NOT NULL DEFAULT '{}', selected_mode TEXT NOT NULL DEFAULT 'active',
      shown_final_status_groups_json TEXT NOT NULL DEFAULT '{}', PRIMARY KEY (workspace_id, content_owner_id)
    )`,
    `CREATE TABLE accordion_view_state (
      workspace_id TEXT NOT NULL, persistence_id TEXT NOT NULL, sections_json TEXT NOT NULL,
      PRIMARY KEY (workspace_id, persistence_id)
    )`,
    `CREATE TABLE markdown_content_ui_state (
      workspace_id TEXT NOT NULL, content_id TEXT NOT NULL, editor_view_state_json TEXT NOT NULL,
      PRIMARY KEY (workspace_id, content_id)
    )`,
    `INSERT INTO app_persistence (id, last_workspace_info_path, app_sidebar_width_px)
      VALUES (1, ${workspaceInfoPath === null ? 'NULL' : toSqlText(workspaceInfoPath)}, 275)`,
    `UPDATE schema_version SET version = ${version}`
  ]) await runSqlStatement(electronApp, sql)
  if (version === 24) {
    for (const sql of [
      'ALTER TABLE prompt_collection_view_state RENAME TO prompt_folder_view_state',
      'ALTER TABLE workspace_ui_state RENAME COLUMN last_prompt_task_collection_id TO last_prompt_task_folder_id',
      'ALTER TABLE workspace_ui_state RENAME COLUMN last_prompt_template_collection_id TO last_prompt_template_folder_id'
    ]) await runSqlStatement(electronApp, sql)
  }
}
