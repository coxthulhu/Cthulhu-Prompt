import { parseWorkspaceScreenSelection } from '@shared/UserPersistence'
import { SqliteDataAccess } from './SqliteDataAccess'

/** SQLite workspace-level state used during stale-row cleanup. */
type WorkspaceUiStateRow = {
  selectedScreen: string
  selectedScreenDataJson: string | null
  lastPromptFolderId: string | null
}

/** Persisted prompt-folder state for one root or category owner. */
type PromptFolderViewRow = {
  contentOwnerId: string
  selectedEntryId: string
  treeIsExpanded: number
  detailsSectionIsExpanded: number
  contentSectionIsExpanded: number
}

/** Persisted category-editor state used during stale-row cleanup. */
type CategoryEditorRow = {
  categoryId: string
  editorViewStateJson: string
}

/** Parses nullable selected-screen JSON without accepting malformed data. */
const parseSelectedScreenDataJson = (value: string | null): unknown => {
  if (value === null) return null
  try {
    return JSON.parse(value)
  } catch {
    return undefined
  }
}

/** Resets stale workspace navigation to the home screen. */
const resetWorkspaceScreenSelection = (workspaceId: string): void => {
  SqliteDataAccess.getDatabase()
    .prepare(
      `UPDATE workspace_ui_state
       SET selected_screen = 'home', selected_screen_data_json = NULL,
           last_prompt_folder_id = NULL
       WHERE workspace_id = ?`
    )
    .run(workspaceId)
}

/** SQLite cleanup operations for split workspace UI-state tables. */
export class WorkspaceUiStateDataAccess {
  /** Removes root/category UI state whose owner no longer exists. */
  static cleanupWorkspacePromptFolderUiState(
    workspaceId: string,
    workspacePromptFolderIds: string[],
    workspaceCategoryIds: string[]
  ): void {
    /** SQLite database containing split workspace UI state. */
    const db = SqliteDataAccess.getDatabase()
    /** Valid root IDs used to validate screen and last-root state. */
    const validPromptFolderIds = new Set(workspacePromptFolderIds)
    /** Valid root and category IDs used to prune owner-scoped state. */
    const validContentOwnerIds = new Set([...workspacePromptFolderIds, ...workspaceCategoryIds])
    /** Atomic cleanup preserving every still-valid row. */
    const cleanup = db.transaction(() => {
      /** Existing owner rows inspected before pruning. */
      const promptFolderRows = db
        .prepare(
          `SELECT content_owner_id AS contentOwnerId,
                  selected_entry_id AS selectedEntryId,
                  tree_is_expanded AS treeIsExpanded,
                  details_section_is_expanded AS detailsSectionIsExpanded,
                  content_section_is_expanded AS contentSectionIsExpanded
           FROM prompt_folder_view_state WHERE workspace_id = ?`
        )
        .all(workspaceId) as PromptFolderViewRow[]
      /** Existing category-editor rows inspected before pruning. */
      const categoryEditorRows = db
        .prepare(
          `SELECT category_id AS categoryId,
                  editor_view_state_json AS editorViewStateJson
           FROM category_description_editor_view_state WHERE workspace_id = ?`
        )
        .all(workspaceId) as CategoryEditorRow[]
      db.prepare('DELETE FROM prompt_folder_view_state WHERE workspace_id = ?').run(workspaceId)
      db.prepare(
        'DELETE FROM category_description_editor_view_state WHERE workspace_id = ?'
      ).run(workspaceId)
      /** Prepared insert for one retained owner row. */
      const insertPromptFolder = db.prepare(
        `INSERT INTO prompt_folder_view_state (
           workspace_id, content_owner_id, selected_entry_id,
           tree_is_expanded, details_section_is_expanded, content_section_is_expanded
         ) VALUES (?, ?, ?, ?, ?, ?)`
      )
      /** Prepared insert for one retained category-editor row. */
      const insertCategoryEditor = db.prepare(
        `INSERT INTO category_description_editor_view_state (
           workspace_id, category_id, editor_view_state_json
         ) VALUES (?, ?, ?)`
      )
      for (const row of promptFolderRows) {
        if (!validContentOwnerIds.has(row.contentOwnerId)) continue
        insertPromptFolder.run(
          workspaceId,
          row.contentOwnerId,
          row.selectedEntryId,
          row.treeIsExpanded,
          row.detailsSectionIsExpanded,
          row.contentSectionIsExpanded
        )
      }
      for (const row of categoryEditorRows) {
        if (!validContentOwnerIds.has(row.categoryId)) continue
        insertCategoryEditor.run(workspaceId, row.categoryId, row.editorViewStateJson)
      }

      /** Current workspace-level row validated after owner pruning. */
      const workspaceRow = db
        .prepare(
          `SELECT selected_screen AS selectedScreen,
                  selected_screen_data_json AS selectedScreenDataJson,
                  last_prompt_folder_id AS lastPromptFolderId
           FROM workspace_ui_state WHERE workspace_id = ?`
        )
        .get(workspaceId) as WorkspaceUiStateRow | undefined
      if (!workspaceRow) return
      /** Parsed discriminated screen selection. */
      const selection = parseWorkspaceScreenSelection(
        workspaceRow.selectedScreen,
        parseSelectedScreenDataJson(workspaceRow.selectedScreenDataJson)
      )
      if (!selection) {
        resetWorkspaceScreenSelection(workspaceId)
        return
      }
      if (
        selection.selectedScreen === 'prompt-folders' &&
        selection.selectedScreenData.promptFolderId &&
        !validPromptFolderIds.has(selection.selectedScreenData.promptFolderId)
      ) {
        resetWorkspaceScreenSelection(workspaceId)
        return
      }
      if (
        workspaceRow.lastPromptFolderId &&
        !validPromptFolderIds.has(workspaceRow.lastPromptFolderId)
      ) {
        db.prepare(
          'UPDATE workspace_ui_state SET last_prompt_folder_id = NULL WHERE workspace_id = ?'
        ).run(workspaceId)
      }
    })
    cleanup()
  }
}
