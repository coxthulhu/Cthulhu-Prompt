import type Database from 'better-sqlite3'
import { WORKSPACE_STATE_SCOPES, type WorkspaceStateType } from './WorkspaceState'

/** Consolidates version-26 state, committing the copies and removal of old tables together. */
export const migrateWorkspaceState = (db: Database.Database): void => {
  db.transaction(() => {
    db.exec(`CREATE TABLE workspace_state (
      workspace_id TEXT,
      state_type TEXT NOT NULL,
      entity_id TEXT,
      storage_scope TEXT NOT NULL CHECK (storage_scope IN ('machine-specific', 'user-specific')),
      data_json TEXT NOT NULL CHECK (json_valid(data_json) AND json_type(data_json) = 'object')
    );
    CREATE UNIQUE INDEX workspace_state_identity ON workspace_state (
      workspace_id IS NULL, COALESCE(workspace_id, ''), state_type,
      entity_id IS NULL, COALESCE(entity_id, '')
    );
    CREATE INDEX workspace_state_workspace_type ON workspace_state (workspace_id, state_type);`)

    /** Inserts legacy projections with the classification owned by their state type. */
    const copy = (stateType: WorkspaceStateType, select: string): void => {
      db.prepare(`INSERT INTO workspace_state (workspace_id, entity_id, data_json, state_type, storage_scope)
        SELECT workspace_id, entity_id, data_json, ?, ? FROM (${select})`)
        .run(stateType, WORKSPACE_STATE_SCOPES[stateType])
    }
    copy('application-user', `SELECT NULL AS workspace_id, NULL AS entity_id,
      json_object('hasShownWelcome', json(CASE WHEN has_shown_welcome THEN 'true' ELSE 'false' END)) AS data_json
      FROM app_persistence WHERE id = 1`)
    copy('application-machine', `SELECT NULL AS workspace_id, NULL AS entity_id,
      json_object('lastWorkspaceInfoPath', last_workspace_info_path, 'appSidebarWidthPx', app_sidebar_width_px) AS data_json
      FROM app_persistence WHERE id = 1`)
    copy('workspace-dialog', `SELECT NULL AS workspace_id, NULL AS entity_id,
      json_object('directory', workspace_dialog_directory) AS data_json FROM app_persistence WHERE id = 1`)
    copy('window', `SELECT NULL AS workspace_id, NULL AS entity_id,
      json_object('x', window_x_px, 'y', window_y_px, 'width', window_width_px, 'height', window_height_px,
        'isMaximized', json(CASE WHEN window_is_maximized IS NULL THEN 'null' WHEN window_is_maximized THEN 'true' ELSE 'false' END),
        'isFullScreen', json(CASE WHEN window_is_fullscreen IS NULL THEN 'null' WHEN window_is_fullscreen THEN 'true' ELSE 'false' END)) AS data_json
      FROM app_persistence WHERE id = 1`)
    copy('workspace-navigation', `SELECT workspace_id, NULL AS entity_id,
      json_object('selectedScreen', selected_screen,
        'selectedScreenData', json(CASE WHEN json_valid(selected_screen_data_json) THEN selected_screen_data_json ELSE 'null' END),
        'lastPromptTaskCollectionId', last_prompt_task_collection_id,
        'lastPromptTemplateCollectionId', last_prompt_template_collection_id) AS data_json FROM workspace_ui_state`)
    copy('collection-user', `SELECT workspace_id, content_owner_id AS entity_id,
      json_object('selectedEntryId', selected_entry_id,
        'treeIsExpanded', json(CASE WHEN tree_is_expanded THEN 'true' ELSE 'false' END),
        'contentSectionIsExpanded', json(CASE WHEN content_section_is_expanded THEN 'true' ELSE 'false' END),
        'selectedMode', selected_mode, 'shownFinalStatusGroups', json(shown_final_status_groups_json)) AS data_json
      FROM prompt_collection_view_state`)
    copy('collection-machine', `SELECT workspace_id, content_owner_id AS entity_id,
      json_object('scrollTopByMode', json(scroll_top_by_mode_json)) AS data_json FROM prompt_collection_view_state`)
    copy('accordion-user', `SELECT workspace_id, persistence_id AS entity_id,
      json_object('sections', json((SELECT json_group_array(json_object(
        'id', json_extract(value, '$.id'),
        'isExpanded', json(CASE WHEN json_extract(value, '$.isExpanded') THEN 'true' ELSE 'false' END)
      )) FROM json_each(sections_json)))) AS data_json FROM accordion_view_state`)
    copy('accordion-machine', `SELECT workspace_id, persistence_id AS entity_id,
      json_object('heights', json((SELECT json_group_object(
        json_extract(value, '$.id'), json_extract(value, '$.configuredExpandedHeightPx')
      ) FROM json_each(sections_json)))) AS data_json FROM accordion_view_state`)
    copy('markdown-editor', `SELECT workspace_id, content_id AS entity_id,
      json_object('editorViewStateJson', editor_view_state_json) AS data_json FROM markdown_content_ui_state`)

    db.exec(`DROP TABLE app_persistence;
      DROP TABLE workspace_ui_state;
      DROP TABLE prompt_collection_view_state;
      DROP TABLE accordion_view_state;
      DROP TABLE markdown_content_ui_state;
      UPDATE schema_version SET version = 27;`)
  })()
}
