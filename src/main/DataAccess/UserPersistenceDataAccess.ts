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
  promptOutlinerWidthPx: number
}

export class UserPersistenceDataAccess {
  static readUserPersistence(): UserPersistence {
    const db = SqliteDataAccess.getDatabase()
    const persistenceRow = db
      .prepare(
        `
        SELECT
          last_workspace_path AS lastWorkspacePath,
          app_sidebar_width_px AS appSidebarWidthPx,
          prompt_outliner_width_px AS promptOutlinerWidthPx
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
      appSidebarWidthPx: Math.round(userPersistence.appSidebarWidthPx),
      promptOutlinerWidthPx: Math.round(userPersistence.promptOutlinerWidthPx)
    }

    db.prepare(
      `
      INSERT INTO app_persistence (
        id,
        last_workspace_path,
        app_sidebar_width_px,
        prompt_outliner_width_px
      )
      VALUES (?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        last_workspace_path = excluded.last_workspace_path,
        app_sidebar_width_px = excluded.app_sidebar_width_px,
        prompt_outliner_width_px = excluded.prompt_outliner_width_px
      `
    ).run(
      APP_PERSISTENCE_ID,
      nextUserPersistence.lastWorkspacePath,
      nextUserPersistence.appSidebarWidthPx,
      nextUserPersistence.promptOutlinerWidthPx
    )

    return nextUserPersistence
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
      .get(workspaceId) as { selectedScreen: string; selectedPromptFolderId: string | null } | undefined

    if (!workspaceUiState) {
      return createDefaultWorkspacePersistence(workspaceId)
    }

    const promptFolderUiStateRows = db
      .prepare(
        `
        SELECT
          prompt_folder_id AS promptFolderId,
          outliner_entry_id AS outlinerEntryId
        FROM prompt_folder_ui_state
        WHERE workspace_id = ?
        `
      )
      .all(workspaceId)

    const parsedPersistence = parseWorkspacePersistence(
      {
        selectedScreen: workspaceUiState.selectedScreen,
        selectedPromptFolderId: workspaceUiState.selectedPromptFolderId,
        promptFolderOutlinerEntries: promptFolderUiStateRows
      },
      workspaceId
    )

    return parsedPersistence ?? createDefaultWorkspacePersistence(workspaceId)
  }

  static updateWorkspacePersistence(workspacePersistence: WorkspacePersistence): WorkspacePersistence {
    const db = SqliteDataAccess.getDatabase()
    const serializableWorkspacePersistence = toSerializableWorkspacePersistence(workspacePersistence)

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
          outliner_entry_id
        )
        VALUES (?, ?, ?)
        `
      )

      for (const entry of serializableWorkspacePersistence.promptFolderOutlinerEntries) {
        insertPromptFolderUiState.run(
          serializableWorkspacePersistence.workspaceId,
          entry.promptFolderId,
          entry.outlinerEntryId
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
            outliner_entry_id AS outlinerEntryId
          FROM prompt_folder_ui_state
          WHERE workspace_id = ?
          `
        )
        .all(workspaceId) as Array<{ promptFolderId: string; outlinerEntryId: string }>

      db.prepare('DELETE FROM prompt_folder_ui_state WHERE workspace_id = ?').run(workspaceId)

      const insertPromptFolderUiState = db.prepare(
        `
        INSERT INTO prompt_folder_ui_state (
          workspace_id,
          prompt_folder_id,
          outliner_entry_id
        )
        VALUES (?, ?, ?)
        `
      )

      for (const entry of existingPromptFolderUiState) {
        if (!validPromptFolderIds.has(entry.promptFolderId)) {
          continue
        }

        insertPromptFolderUiState.run(workspaceId, entry.promptFolderId, entry.outlinerEntryId)
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
