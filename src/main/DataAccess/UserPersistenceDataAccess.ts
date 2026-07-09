import {
  DEFAULT_USER_PERSISTENCE,
  copyPromptFolderSettingsEditorViewStates,
  createDefaultWorkspacePersistence,
  createEmptyPromptFolderSettingsEditorViewStates,
  parseWorkspaceScreenSelection,
  parseWorkspacePersistence,
  toSerializableWorkspacePersistence,
  parseUserPersistence,
  type UserPersistence,
  type WorkspacePersistence
} from '@shared/UserPersistence'
import { PROMPT_FOLDER_SETTINGS_FIELDS, type PromptFolderSettingsField } from '@shared/PromptFolder'
import { SqliteDataAccess } from './SqliteDataAccess'

const APP_PERSISTENCE_ID = 1

type UserPersistenceRow = {
  lastWorkspaceInfoPath: string | null
  appSidebarWidthPx: number
}

type WindowPersistenceRow = {
  windowXPx: number | null
  windowYPx: number | null
  windowWidthPx: number | null
  windowHeightPx: number | null
  windowIsMaximized: number | null
  windowIsFullScreen: number | null
}

type WorkspaceUiStateRow = {
  selectedScreen: string
  selectedScreenDataJson: string | null
  lastPromptFolderId: string | null
}

type PromptFolderUiStateRow = {
  promptFolderId: string
  promptTreeEntryId: string
  promptTreeIsExpanded: number
  folderSettingsSectionIsExpanded: number
  promptsSectionIsExpanded: number
}

type PromptFolderSettingsEditorViewStateRow = {
  promptFolderId: string
  settingsField: PromptFolderSettingsField
  editorViewStateJson: string
}

export type WindowPersistence = {
  x: number | null
  y: number | null
  width: number | null
  height: number | null
  isMaximized: boolean | null
  isFullScreen: boolean | null
}

const DEFAULT_WINDOW_PERSISTENCE: WindowPersistence = {
  x: null,
  y: null,
  width: null,
  height: null,
  isMaximized: null,
  isFullScreen: null
}

const parseSelectedScreenDataJson = (value: string | null): unknown => {
  if (value === null) {
    return null
  }

  try {
    return JSON.parse(value)
  } catch {
    return undefined
  }
}

export class UserPersistenceDataAccess {
  static readUserPersistence(): UserPersistence {
    const db = SqliteDataAccess.getDatabase()
    const persistenceRow = db
      .prepare(
        `
        SELECT
          last_workspace_info_path AS lastWorkspaceInfoPath,
          app_sidebar_width_px AS appSidebarWidthPx
        FROM app_persistence
        WHERE id = ?
        `
      )
      .get(APP_PERSISTENCE_ID) as UserPersistenceRow | undefined
    const parsedPersistence = parseUserPersistence(persistenceRow)

    return parsedPersistence ?? DEFAULT_USER_PERSISTENCE
  }

  static updateUserPersistence(userPersistence: UserPersistence): UserPersistence {
    const db = SqliteDataAccess.getDatabase()
    const nextUserPersistence = {
      lastWorkspaceInfoPath: userPersistence.lastWorkspaceInfoPath,
      appSidebarWidthPx: Math.round(userPersistence.appSidebarWidthPx)
    }

    db.prepare(
      `
      INSERT INTO app_persistence (
        id,
        last_workspace_info_path,
        app_sidebar_width_px
      )
      VALUES (?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        last_workspace_info_path = excluded.last_workspace_info_path,
        app_sidebar_width_px = excluded.app_sidebar_width_px
      `
    ).run(
      APP_PERSISTENCE_ID,
      nextUserPersistence.lastWorkspaceInfoPath,
      nextUserPersistence.appSidebarWidthPx
    )

    return nextUserPersistence
  }

  static readWindowPersistence(): WindowPersistence {
    const db = SqliteDataAccess.getDatabase()
    const persistenceRow = db
      .prepare(
        `
        SELECT
          window_x_px AS windowXPx,
          window_y_px AS windowYPx,
          window_width_px AS windowWidthPx,
          window_height_px AS windowHeightPx,
          window_is_maximized AS windowIsMaximized,
          window_is_fullscreen AS windowIsFullScreen
        FROM app_persistence
        WHERE id = ?
        `
      )
      .get(APP_PERSISTENCE_ID) as WindowPersistenceRow | undefined

    if (!persistenceRow) {
      return DEFAULT_WINDOW_PERSISTENCE
    }

    return {
      x: persistenceRow.windowXPx === null ? null : Math.round(persistenceRow.windowXPx),
      y: persistenceRow.windowYPx === null ? null : Math.round(persistenceRow.windowYPx),
      width:
        persistenceRow.windowWidthPx === null ? null : Math.round(persistenceRow.windowWidthPx),
      height:
        persistenceRow.windowHeightPx === null ? null : Math.round(persistenceRow.windowHeightPx),
      isMaximized:
        persistenceRow.windowIsMaximized === null
          ? null
          : Boolean(persistenceRow.windowIsMaximized),
      isFullScreen:
        persistenceRow.windowIsFullScreen === null
          ? null
          : Boolean(persistenceRow.windowIsFullScreen)
    }
  }

  static updateWindowPersistence(windowPersistence: WindowPersistence): void {
    const db = SqliteDataAccess.getDatabase()
    const nextWindowPersistence = {
      x: windowPersistence.x === null ? null : Math.round(windowPersistence.x),
      y: windowPersistence.y === null ? null : Math.round(windowPersistence.y),
      width: windowPersistence.width === null ? null : Math.round(windowPersistence.width),
      height: windowPersistence.height === null ? null : Math.round(windowPersistence.height),
      isMaximized:
        windowPersistence.isMaximized === null ? null : windowPersistence.isMaximized ? 1 : 0,
      isFullScreen:
        windowPersistence.isFullScreen === null ? null : windowPersistence.isFullScreen ? 1 : 0
    }

    db.prepare(
      `
      UPDATE app_persistence
      SET
        window_x_px = ?,
        window_y_px = ?,
        window_width_px = ?,
        window_height_px = ?,
        window_is_maximized = ?,
        window_is_fullscreen = ?
      WHERE id = ?
      `
    ).run(
      nextWindowPersistence.x,
      nextWindowPersistence.y,
      nextWindowPersistence.width,
      nextWindowPersistence.height,
      nextWindowPersistence.isMaximized,
      nextWindowPersistence.isFullScreen,
      APP_PERSISTENCE_ID
    )
  }

  static readWorkspacePersistence(workspaceId: string): WorkspacePersistence {
    const db = SqliteDataAccess.getDatabase()
    const workspaceUiState = db
      .prepare(
        `
        SELECT
          selected_screen AS selectedScreen,
          selected_screen_data_json AS selectedScreenDataJson,
          last_prompt_folder_id AS lastPromptFolderId
        FROM workspace_ui_state
        WHERE workspace_id = ?
        `
      )
      .get(workspaceId) as WorkspaceUiStateRow | undefined

    if (!workspaceUiState) {
      return createDefaultWorkspacePersistence(workspaceId)
    }

    const promptFolderUiStateRows = db
      .prepare(
        `
        SELECT
          prompt_folder_id AS promptFolderId,
          prompt_tree_entry_id AS promptTreeEntryId,
          prompt_tree_is_expanded AS promptTreeIsExpanded,
          folder_settings_section_is_expanded AS folderSettingsSectionIsExpanded,
          prompts_section_is_expanded AS promptsSectionIsExpanded
        FROM prompt_folder_ui_state
        WHERE workspace_id = ?
        `
      )
      .all(workspaceId) as PromptFolderUiStateRow[]

    const settingsEditorViewStateRows = db
      .prepare(
        `
        SELECT
          prompt_folder_id AS promptFolderId,
          settings_field AS settingsField,
          editor_view_state_json AS editorViewStateJson
        FROM prompt_folder_settings_editor_view_state
        WHERE workspace_id = ?
        `
      )
      .all(workspaceId) as PromptFolderSettingsEditorViewStateRow[]

    const settingsEditorViewStatesByFolderId = new Map<
      string,
      Record<PromptFolderSettingsField, string | null>
    >()

    for (const row of settingsEditorViewStateRows) {
      if (!PROMPT_FOLDER_SETTINGS_FIELDS.includes(row.settingsField)) {
        continue
      }

      const viewStates =
        settingsEditorViewStatesByFolderId.get(row.promptFolderId) ??
        createEmptyPromptFolderSettingsEditorViewStates()
      viewStates[row.settingsField] = row.editorViewStateJson
      settingsEditorViewStatesByFolderId.set(row.promptFolderId, viewStates)
    }

    const serializablePromptFolderUiStateRows = promptFolderUiStateRows.map((row) => ({
      promptFolderId: row.promptFolderId,
      promptTreeEntryId: row.promptTreeEntryId,
      promptTreeIsExpanded: row.promptTreeIsExpanded !== 0,
      folderSettingsSectionIsExpanded: row.folderSettingsSectionIsExpanded !== 0,
      promptsSectionIsExpanded: row.promptsSectionIsExpanded !== 0,
      settingsEditorViewStates: copyPromptFolderSettingsEditorViewStates(
        settingsEditorViewStatesByFolderId.get(row.promptFolderId) ??
          createEmptyPromptFolderSettingsEditorViewStates()
      )
    }))

    const selectedScreenData = parseSelectedScreenDataJson(workspaceUiState.selectedScreenDataJson)
    const parsedPersistence = parseWorkspacePersistence(
      {
        selectedScreen: workspaceUiState.selectedScreen,
        selectedScreenData,
        lastPromptFolderId: workspaceUiState.lastPromptFolderId,
        promptFolderPromptTreeEntries: serializablePromptFolderUiStateRows
      },
      workspaceId
    )

    if (parsedPersistence) {
      return parsedPersistence
    }

    this.resetWorkspaceScreenSelection(workspaceId)
    return {
      ...createDefaultWorkspacePersistence(workspaceId),
      promptFolderPromptTreeEntries: serializablePromptFolderUiStateRows
    }
  }

  static updateWorkspacePersistence(
    workspacePersistence: WorkspacePersistence
  ): WorkspacePersistence {
    const db = SqliteDataAccess.getDatabase()
    const serializableWorkspacePersistence =
      toSerializableWorkspacePersistence(workspacePersistence)

    const updateWorkspace = db.transaction(() => {
      db.prepare(
        `
        INSERT INTO workspace_ui_state (
          workspace_id,
          selected_screen,
          selected_screen_data_json,
          last_prompt_folder_id
        )
        VALUES (?, ?, ?, ?)
        ON CONFLICT(workspace_id) DO UPDATE SET
          selected_screen = excluded.selected_screen,
          selected_screen_data_json = excluded.selected_screen_data_json,
          last_prompt_folder_id = excluded.last_prompt_folder_id
        `
      ).run(
        serializableWorkspacePersistence.workspaceId,
        serializableWorkspacePersistence.selectedScreen,
        serializableWorkspacePersistence.selectedScreenData === null
          ? null
          : JSON.stringify(serializableWorkspacePersistence.selectedScreenData),
        serializableWorkspacePersistence.lastPromptFolderId
      )

      db.prepare('DELETE FROM prompt_folder_ui_state WHERE workspace_id = ?').run(
        serializableWorkspacePersistence.workspaceId
      )
      db.prepare('DELETE FROM prompt_folder_settings_editor_view_state WHERE workspace_id = ?').run(
        serializableWorkspacePersistence.workspaceId
      )

      const insertPromptFolderUiState = db.prepare(
        `
        INSERT INTO prompt_folder_ui_state (
          workspace_id,
          prompt_folder_id,
          prompt_tree_entry_id,
          prompt_tree_is_expanded,
          folder_settings_section_is_expanded,
          prompts_section_is_expanded
        )
        VALUES (?, ?, ?, ?, ?, ?)
        `
      )
      const insertSettingsEditorViewState = db.prepare(
        `
        INSERT INTO prompt_folder_settings_editor_view_state (
          workspace_id,
          prompt_folder_id,
          settings_field,
          editor_view_state_json
        )
        VALUES (?, ?, ?, ?)
        `
      )

      for (const entry of serializableWorkspacePersistence.promptFolderPromptTreeEntries) {
        insertPromptFolderUiState.run(
          serializableWorkspacePersistence.workspaceId,
          entry.promptFolderId,
          entry.promptTreeEntryId,
          entry.promptTreeIsExpanded ? 1 : 0,
          entry.folderSettingsSectionIsExpanded ? 1 : 0,
          entry.promptsSectionIsExpanded ? 1 : 0
        )

        for (const field of PROMPT_FOLDER_SETTINGS_FIELDS) {
          const viewStateJson = entry.settingsEditorViewStates[field]
          if (viewStateJson === null) {
            continue
          }

          insertSettingsEditorViewState.run(
            serializableWorkspacePersistence.workspaceId,
            entry.promptFolderId,
            field,
            viewStateJson
          )
        }
      }
    })

    updateWorkspace()

    return serializableWorkspacePersistence
  }

  static cleanupWorkspacePromptFolderUiState(
    workspaceId: string,
    workspacePromptFolderIds: string[]
  ): void {
    const db = SqliteDataAccess.getDatabase()
    const validPromptFolderIds = new Set(workspacePromptFolderIds)

    const cleanupWorkspaceState = db.transaction(() => {
      const existingPromptFolderUiState = db
        .prepare(
          `
          SELECT
            prompt_folder_id AS promptFolderId,
            prompt_tree_entry_id AS promptTreeEntryId,
            prompt_tree_is_expanded AS promptTreeIsExpanded,
            folder_settings_section_is_expanded AS folderSettingsSectionIsExpanded,
            prompts_section_is_expanded AS promptsSectionIsExpanded
          FROM prompt_folder_ui_state
          WHERE workspace_id = ?
          `
        )
        .all(workspaceId) as PromptFolderUiStateRow[]

      const existingSettingsEditorViewStates = db
        .prepare(
          `
          SELECT
            prompt_folder_id AS promptFolderId,
            settings_field AS settingsField,
            editor_view_state_json AS editorViewStateJson
          FROM prompt_folder_settings_editor_view_state
          WHERE workspace_id = ?
          `
        )
        .all(workspaceId) as PromptFolderSettingsEditorViewStateRow[]

      db.prepare('DELETE FROM prompt_folder_ui_state WHERE workspace_id = ?').run(workspaceId)
      db.prepare('DELETE FROM prompt_folder_settings_editor_view_state WHERE workspace_id = ?').run(
        workspaceId
      )

      const insertPromptFolderUiState = db.prepare(
        `
        INSERT INTO prompt_folder_ui_state (
          workspace_id,
          prompt_folder_id,
          prompt_tree_entry_id,
          prompt_tree_is_expanded,
          folder_settings_section_is_expanded,
          prompts_section_is_expanded
        )
        VALUES (?, ?, ?, ?, ?, ?)
        `
      )
      const insertSettingsEditorViewState = db.prepare(
        `
        INSERT INTO prompt_folder_settings_editor_view_state (
          workspace_id,
          prompt_folder_id,
          settings_field,
          editor_view_state_json
        )
        VALUES (?, ?, ?, ?)
        `
      )

      for (const entry of existingPromptFolderUiState) {
        if (!validPromptFolderIds.has(entry.promptFolderId)) {
          continue
        }

        insertPromptFolderUiState.run(
          workspaceId,
          entry.promptFolderId,
          entry.promptTreeEntryId,
          entry.promptTreeIsExpanded,
          entry.folderSettingsSectionIsExpanded,
          entry.promptsSectionIsExpanded
        )
      }

      for (const entry of existingSettingsEditorViewStates) {
        if (!validPromptFolderIds.has(entry.promptFolderId)) {
          continue
        }

        insertSettingsEditorViewState.run(
          workspaceId,
          entry.promptFolderId,
          entry.settingsField,
          entry.editorViewStateJson
        )
      }

      const selectedWorkspaceState = db
        .prepare(
          `
          SELECT
            selected_screen AS selectedScreen,
            selected_screen_data_json AS selectedScreenDataJson,
            last_prompt_folder_id AS lastPromptFolderId
          FROM workspace_ui_state
          WHERE workspace_id = ?
          `
        )
        .get(workspaceId) as WorkspaceUiStateRow | undefined

      if (!selectedWorkspaceState) {
        return
      }

      const selectedScreenData = parseSelectedScreenDataJson(
        selectedWorkspaceState.selectedScreenDataJson
      )
      const selectedWorkspaceScreen = parseWorkspaceScreenSelection(
        selectedWorkspaceState.selectedScreen,
        selectedScreenData
      )

      if (!selectedWorkspaceScreen) {
        UserPersistenceDataAccess.resetWorkspaceScreenSelection(workspaceId)
        return
      }

      if (
        selectedWorkspaceScreen.selectedScreen === 'prompt-folders' &&
        selectedWorkspaceScreen.selectedScreenData.promptFolderId &&
        !validPromptFolderIds.has(selectedWorkspaceScreen.selectedScreenData.promptFolderId)
      ) {
        UserPersistenceDataAccess.resetWorkspaceScreenSelection(workspaceId)
      }

      if (
        selectedWorkspaceState.lastPromptFolderId &&
        !validPromptFolderIds.has(selectedWorkspaceState.lastPromptFolderId)
      ) {
        db.prepare(
          `
          UPDATE workspace_ui_state
          SET last_prompt_folder_id = NULL
          WHERE workspace_id = ?
          `
        ).run(workspaceId)
      }
    })

    cleanupWorkspaceState()
  }

  private static resetWorkspaceScreenSelection(workspaceId: string): void {
    const db = SqliteDataAccess.getDatabase()
    db.prepare(
      `
      UPDATE workspace_ui_state
      SET selected_screen = 'home',
          selected_screen_data_json = NULL,
          last_prompt_folder_id = NULL
      WHERE workspace_id = ?
      `
    ).run(workspaceId)
  }
}
