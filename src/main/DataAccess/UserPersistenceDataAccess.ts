import {
  DEFAULT_USER_PERSISTENCE,
  createDefaultWorkspacePersistence,
  parseWorkspacePersistence,
  toSerializableWorkspacePersistence,
  parseUserPersistence,
  type UserPersistence,
  type WorkspacePersistence
} from '@shared/UserPersistence'
import { SqliteDataAccess } from './SqliteDataAccess'

const APP_PERSISTENCE_ID = 1

type UserPersistenceRow = {
  lastWorkspacePath: string | null
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

export class UserPersistenceDataAccess {
  static readUserPersistence(): UserPersistence {
    const db = SqliteDataAccess.getDatabase()
    const persistenceRow = db
      .prepare(
        `
        SELECT
          last_workspace_path AS lastWorkspacePath,
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
      lastWorkspacePath: userPersistence.lastWorkspacePath,
      appSidebarWidthPx: Math.round(userPersistence.appSidebarWidthPx)
    }

    db.prepare(
      `
      INSERT INTO app_persistence (
        id,
        last_workspace_path,
        app_sidebar_width_px
      )
      VALUES (?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        last_workspace_path = excluded.last_workspace_path,
        app_sidebar_width_px = excluded.app_sidebar_width_px
      `
    ).run(
      APP_PERSISTENCE_ID,
      nextUserPersistence.lastWorkspacePath,
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
          selected_prompt_folder_id AS selectedPromptFolderId
        FROM workspace_ui_state
        WHERE workspace_id = ?
        `
      )
      .get(workspaceId) as
      | { selectedScreen: string; selectedPromptFolderId: string | null }
      | undefined

    if (!workspaceUiState) {
      return createDefaultWorkspacePersistence(workspaceId)
    }

    const promptFolderUiStateRows = db
      .prepare(
        `
        SELECT
          prompt_folder_id AS promptFolderId,
          prompt_tree_entry_id AS promptTreeEntryId,
          folder_description_editor_view_state_json AS folderDescriptionEditorViewStateJson
        FROM prompt_folder_ui_state
        WHERE workspace_id = ?
        `
      )
      .all(workspaceId)

    const parsedPersistence = parseWorkspacePersistence(
      {
        selectedScreen: workspaceUiState.selectedScreen,
        selectedPromptFolderId: workspaceUiState.selectedPromptFolderId,
        promptFolderPromptTreeEntries: promptFolderUiStateRows
      },
      workspaceId
    )

    return parsedPersistence ?? createDefaultWorkspacePersistence(workspaceId)
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
          selected_prompt_folder_id
        )
        VALUES (?, ?, ?)
        ON CONFLICT(workspace_id) DO UPDATE SET
          selected_screen = excluded.selected_screen,
          selected_prompt_folder_id = excluded.selected_prompt_folder_id
        `
      ).run(
        serializableWorkspacePersistence.workspaceId,
        serializableWorkspacePersistence.selectedScreen,
        serializableWorkspacePersistence.selectedPromptFolderId
      )

      db.prepare('DELETE FROM prompt_folder_ui_state WHERE workspace_id = ?').run(
        serializableWorkspacePersistence.workspaceId
      )

      const insertPromptFolderUiState = db.prepare(
        `
        INSERT INTO prompt_folder_ui_state (
          workspace_id,
          prompt_folder_id,
          prompt_tree_entry_id,
          folder_description_editor_view_state_json
        )
        VALUES (?, ?, ?, ?)
        `
      )

      for (const entry of serializableWorkspacePersistence.promptFolderPromptTreeEntries) {
        insertPromptFolderUiState.run(
          serializableWorkspacePersistence.workspaceId,
          entry.promptFolderId,
          entry.promptTreeEntryId,
          entry.folderDescriptionEditorViewStateJson
        )
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
            folder_description_editor_view_state_json AS folderDescriptionEditorViewStateJson
          FROM prompt_folder_ui_state
          WHERE workspace_id = ?
          `
        )
        .all(workspaceId) as Array<{
        promptFolderId: string
        promptTreeEntryId: string
        folderDescriptionEditorViewStateJson: string | null
      }>

      db.prepare('DELETE FROM prompt_folder_ui_state WHERE workspace_id = ?').run(workspaceId)

      const insertPromptFolderUiState = db.prepare(
        `
        INSERT INTO prompt_folder_ui_state (
          workspace_id,
          prompt_folder_id,
          prompt_tree_entry_id,
          folder_description_editor_view_state_json
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
          entry.folderDescriptionEditorViewStateJson
        )
      }

      const selectedWorkspaceFolder = db
        .prepare(
          `
          SELECT selected_prompt_folder_id AS selectedPromptFolderId
          FROM workspace_ui_state
          WHERE workspace_id = ?
          `
        )
        .get(workspaceId) as { selectedPromptFolderId: string | null } | undefined

      if (
        selectedWorkspaceFolder?.selectedPromptFolderId &&
        !validPromptFolderIds.has(selectedWorkspaceFolder.selectedPromptFolderId)
      ) {
        db.prepare(
          `
          UPDATE workspace_ui_state
          SET selected_screen = 'home',
              selected_prompt_folder_id = NULL
          WHERE workspace_id = ?
          `
        ).run(workspaceId)
      }
    })

    cleanupWorkspaceState()
  }
}
