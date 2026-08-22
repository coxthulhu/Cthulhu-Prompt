import {
  DEFAULT_USER_PERSISTENCE,
  createDefaultWorkspacePersistence,
  parseWorkspaceScreenSelection,
  parseWorkspacePersistence,
  toSerializableWorkspacePersistence,
  parseUserPersistence,
  type UserPersistence,
  type WorkspacePersistence
} from '@shared/UserPersistence'
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

/** Persisted prompt-folder screen state for one root or category content owner. */
type PromptFolderViewRow = {
  contentOwnerId: string
  selectedEntryId: string
  treeIsExpanded: number
  detailsSectionIsExpanded: number
  contentSectionIsExpanded: number
}

/** Persisted category description editor state. */
type CategoryDescriptionEditorViewStateRow = {
  contentOwnerId: string
  categoryDescriptionEditorViewStateJson: string
}

/** SQLite row for one workspace accordion instance. */
type AccordionViewRow = {
  persistenceId: string
  expandedSectionIdsJson: string
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

/** Parses the section ID array stored for one accordion instance. */
const parseExpandedSectionIdsJson = (value: string): string[] => {
  try {
    /** JSON value read from the accordion view-state row. */
    const parsed = JSON.parse(value)
    return Array.isArray(parsed) && parsed.every((sectionId) => typeof sectionId === 'string')
      ? parsed
      : []
  } catch {
    return []
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

    const promptFolderViewRows = db
      .prepare(
        `
        SELECT
          content_owner_id AS contentOwnerId,
          selected_entry_id AS selectedEntryId,
          tree_is_expanded AS treeIsExpanded,
          details_section_is_expanded AS detailsSectionIsExpanded,
          content_section_is_expanded AS contentSectionIsExpanded
        FROM prompt_folder_view_state
        WHERE workspace_id = ?
        `
      )
      .all(workspaceId) as PromptFolderViewRow[]

    const categoryDescriptionEditorViewStateRows = db
      .prepare(
        `
        SELECT
          category_id AS contentOwnerId,
          editor_view_state_json AS categoryDescriptionEditorViewStateJson
        FROM category_description_editor_view_state
        WHERE workspace_id = ?
        `
      )
      .all(workspaceId) as CategoryDescriptionEditorViewStateRow[]

    /** Workspace accordion expansion rows loaded from SQLite. */
    const accordionViewRows = db
      .prepare(
        `
        SELECT
          persistence_id AS persistenceId,
          expanded_section_ids_json AS expandedSectionIdsJson
        FROM accordion_view_state
        WHERE workspace_id = ?
        `
      )
      .all(workspaceId) as AccordionViewRow[]

    /** Category description editor state keyed by category ID. */
    const categoryDescriptionEditorViewStateByCategoryId = new Map<string, string>()
    for (const row of categoryDescriptionEditorViewStateRows) {
      categoryDescriptionEditorViewStateByCategoryId.set(
        row.contentOwnerId,
        row.categoryDescriptionEditorViewStateJson
      )
    }

    /** Serializable prompt-folder screen state loaded from SQLite. */
    const serializablePromptFolderViewEntries = promptFolderViewRows.map((row) => ({
      contentOwnerId: row.contentOwnerId,
      selectedEntryId: row.selectedEntryId,
      treeIsExpanded: row.treeIsExpanded !== 0,
      detailsSectionIsExpanded: row.detailsSectionIsExpanded !== 0,
      contentSectionIsExpanded: row.contentSectionIsExpanded !== 0,
      categoryDescriptionEditorViewStateJson:
        categoryDescriptionEditorViewStateByCategoryId.get(row.contentOwnerId) ?? null
    }))

    /** Serializable accordion expansion state loaded for the workspace. */
    const accordionViewEntries = accordionViewRows.map((row) => ({
      persistenceId: row.persistenceId,
      expandedSectionIds: parseExpandedSectionIdsJson(row.expandedSectionIdsJson)
    }))

    const selectedScreenData = parseSelectedScreenDataJson(workspaceUiState.selectedScreenDataJson)
    const parsedPersistence = parseWorkspacePersistence(
      {
        selectedScreen: workspaceUiState.selectedScreen,
        selectedScreenData,
        lastPromptFolderId: workspaceUiState.lastPromptFolderId,
        promptFolderViewEntries: serializablePromptFolderViewEntries,
        accordionViewEntries
      },
      workspaceId
    )

    if (parsedPersistence) {
      return parsedPersistence
    }

    this.resetWorkspaceScreenSelection(workspaceId)
    return {
      ...createDefaultWorkspacePersistence(workspaceId),
      promptFolderViewEntries: serializablePromptFolderViewEntries,
      accordionViewEntries
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

      db.prepare('DELETE FROM prompt_folder_view_state WHERE workspace_id = ?').run(
        serializableWorkspacePersistence.workspaceId
      )
      db.prepare('DELETE FROM category_description_editor_view_state WHERE workspace_id = ?').run(
        serializableWorkspacePersistence.workspaceId
      )
      db.prepare('DELETE FROM accordion_view_state WHERE workspace_id = ?').run(
        serializableWorkspacePersistence.workspaceId
      )

      /** Inserts one prompt-folder screen view entry. */
      const insertPromptFolderView = db.prepare(
        `
        INSERT INTO prompt_folder_view_state (
          workspace_id,
          content_owner_id,
          selected_entry_id,
          tree_is_expanded,
          details_section_is_expanded,
          content_section_is_expanded
        )
        VALUES (?, ?, ?, ?, ?, ?)
        `
      )
      /** Inserts one category description editor view state. */
      const insertCategoryDescriptionEditorViewState = db.prepare(
        `
        INSERT INTO category_description_editor_view_state (
          workspace_id,
          category_id,
          editor_view_state_json
        )
        VALUES (?, ?, ?)
        `
      )
      /** Inserts one workspace accordion expansion entry. */
      const insertAccordionView = db.prepare(
        `
        INSERT INTO accordion_view_state (
          workspace_id,
          persistence_id,
          expanded_section_ids_json
        )
        VALUES (?, ?, ?)
        `
      )

      for (const entry of serializableWorkspacePersistence.promptFolderViewEntries) {
        insertPromptFolderView.run(
          serializableWorkspacePersistence.workspaceId,
          entry.contentOwnerId,
          entry.selectedEntryId,
          entry.treeIsExpanded ? 1 : 0,
          entry.detailsSectionIsExpanded ? 1 : 0,
          entry.contentSectionIsExpanded ? 1 : 0
        )

        if (entry.categoryDescriptionEditorViewStateJson !== null) {
          insertCategoryDescriptionEditorViewState.run(
            serializableWorkspacePersistence.workspaceId,
            entry.contentOwnerId,
            entry.categoryDescriptionEditorViewStateJson
          )
        }
      }

      for (const entry of serializableWorkspacePersistence.accordionViewEntries) {
        insertAccordionView.run(
          serializableWorkspacePersistence.workspaceId,
          entry.persistenceId,
          JSON.stringify(entry.expandedSectionIds)
        )
      }
    })

    updateWorkspace()

    return serializableWorkspacePersistence
  }

  /** Removes workspace view state whose root-folder or category owner no longer exists. */
  static cleanupWorkspacePromptFolderViewState(
    workspaceId: string,
    workspacePromptFolderIds: string[],
    workspaceCategoryIds: string[]
  ): void {
    const db = SqliteDataAccess.getDatabase()
    const validPromptFolderIds = new Set(workspacePromptFolderIds)
    /** Valid root-folder and category owners for prompt-folder screen view entries. */
    const validContentOwnerIds = new Set([...workspacePromptFolderIds, ...workspaceCategoryIds])

    const cleanupWorkspaceState = db.transaction(() => {
      /** Existing prompt-folder view entries retained for valid content owners. */
      const existingPromptFolderViewEntries = db
        .prepare(
          `
          SELECT
            content_owner_id AS contentOwnerId,
            selected_entry_id AS selectedEntryId,
            tree_is_expanded AS treeIsExpanded,
            details_section_is_expanded AS detailsSectionIsExpanded,
            content_section_is_expanded AS contentSectionIsExpanded
          FROM prompt_folder_view_state
          WHERE workspace_id = ?
          `
        )
        .all(workspaceId) as PromptFolderViewRow[]

      /** Existing category description editor states retained for valid categories. */
      const existingCategoryDescriptionEditorViewStates = db
        .prepare(
          `
          SELECT
            category_id AS contentOwnerId,
            editor_view_state_json AS categoryDescriptionEditorViewStateJson
          FROM category_description_editor_view_state
          WHERE workspace_id = ?
          `
        )
        .all(workspaceId) as CategoryDescriptionEditorViewStateRow[]

      db.prepare('DELETE FROM prompt_folder_view_state WHERE workspace_id = ?').run(workspaceId)
      db.prepare('DELETE FROM category_description_editor_view_state WHERE workspace_id = ?').run(
        workspaceId
      )

      /** Reinserts one retained prompt-folder view entry. */
      const insertPromptFolderView = db.prepare(
        `
        INSERT INTO prompt_folder_view_state (
          workspace_id,
          content_owner_id,
          selected_entry_id,
          tree_is_expanded,
          details_section_is_expanded,
          content_section_is_expanded
        )
        VALUES (?, ?, ?, ?, ?, ?)
        `
      )
      /** Reinserts one retained category description editor state. */
      const insertCategoryDescriptionEditorViewState = db.prepare(
        `
        INSERT INTO category_description_editor_view_state (
          workspace_id,
          category_id,
          editor_view_state_json
        )
        VALUES (?, ?, ?)
        `
      )

      for (const entry of existingPromptFolderViewEntries) {
        if (!validContentOwnerIds.has(entry.contentOwnerId)) {
          continue
        }

        insertPromptFolderView.run(
          workspaceId,
          entry.contentOwnerId,
          entry.selectedEntryId,
          entry.treeIsExpanded,
          entry.detailsSectionIsExpanded,
          entry.contentSectionIsExpanded
        )
      }

      for (const entry of existingCategoryDescriptionEditorViewStates) {
        if (!validContentOwnerIds.has(entry.contentOwnerId)) {
          continue
        }

        insertCategoryDescriptionEditorViewState.run(
          workspaceId,
          entry.contentOwnerId,
          entry.categoryDescriptionEditorViewStateJson
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
