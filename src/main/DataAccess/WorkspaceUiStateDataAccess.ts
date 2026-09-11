import { parseWorkspaceScreenSelection } from '@shared/UserPersistence'
import { SqliteDataAccess } from './SqliteDataAccess'

/** SQLite workspace-level state used during stale-row cleanup. */
type WorkspaceUiStateRow = {
  selectedScreen: string
  selectedScreenDataJson: string | null
  lastPromptTaskFolderId: string | null
  lastPromptTemplateFolderId: string | null
}

/** Persisted prompt-folder state for one root or category owner. */
type PromptFolderViewRow = {
  contentOwnerId: string
  selectedEntryId: string
  treeIsExpanded: number
  contentSectionIsExpanded: number
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

/** Resets stale workspace navigation while preserving valid per-kind root memories. */
const resetWorkspaceScreenSelection = (workspaceId: string): void => {
  SqliteDataAccess.getDatabase()
    .prepare(
      `UPDATE workspace_ui_state
       SET selected_screen = 'home', selected_screen_data_json = NULL
       WHERE workspace_id = ?`
    )
    .run(workspaceId)
}

/** SQLite cleanup operations for split workspace UI-state tables. */
export class WorkspaceUiStateDataAccess {
  /** Removes root/category UI state whose owner no longer exists. */
  static cleanupWorkspacePromptFolderUiState(
    workspaceId: string,
    workspacePromptTaskFolderIds: string[],
    workspacePromptTemplateFolderIds: string[],
    workspaceCategoryIds: string[]
  ): void {
    /** SQLite database containing split workspace UI state. */
    const db = SqliteDataAccess.getDatabase()
    /** Valid root IDs used to validate screen and last-root state. */
    const validPromptTaskFolderIds = new Set(workspacePromptTaskFolderIds)
    /** Valid prompt-template roots used to validate template navigation state. */
    const validPromptTemplateFolderIds = new Set(workspacePromptTemplateFolderIds)
    /** Every valid root ID used to retain root-owned view state. */
    const validPromptFolderIds = new Set([
      ...workspacePromptTaskFolderIds,
      ...workspacePromptTemplateFolderIds
    ])
    /** Valid root and category IDs used to prune owner-scoped state. */
    const validContentOwnerIds = new Set([...validPromptFolderIds, ...workspaceCategoryIds])
    /** Atomic cleanup preserving every still-valid row. */
    const cleanup = db.transaction(() => {
      /** Existing owner rows inspected before pruning. */
      const promptFolderRows = db
        .prepare(
          `SELECT content_owner_id AS contentOwnerId,
                  selected_entry_id AS selectedEntryId,
                  tree_is_expanded AS treeIsExpanded,
                  content_section_is_expanded AS contentSectionIsExpanded
           FROM prompt_folder_view_state WHERE workspace_id = ?`
        )
        .all(workspaceId) as PromptFolderViewRow[]
      db.prepare('DELETE FROM prompt_folder_view_state WHERE workspace_id = ?').run(workspaceId)
      /** Prepared insert for one retained owner row. */
      const insertPromptFolder = db.prepare(
        `INSERT INTO prompt_folder_view_state (
           workspace_id, content_owner_id, selected_entry_id,
           tree_is_expanded, content_section_is_expanded
         ) VALUES (?, ?, ?, ?, ?)`
      )
      for (const row of promptFolderRows) {
        if (!validContentOwnerIds.has(row.contentOwnerId)) continue
        insertPromptFolder.run(
          workspaceId,
          row.contentOwnerId,
          row.selectedEntryId,
          row.treeIsExpanded,
          row.contentSectionIsExpanded
        )
      }

      /** Current workspace-level row validated after owner pruning. */
      const workspaceRow = db
        .prepare(
          `SELECT selected_screen AS selectedScreen,
                  selected_screen_data_json AS selectedScreenDataJson,
                  last_prompt_task_folder_id AS lastPromptTaskFolderId,
                  last_prompt_template_folder_id AS lastPromptTemplateFolderId
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
      } else if (
        (selection.selectedScreen === 'prompt-task-folders' ||
          selection.selectedScreen === 'prompt-template-folders') &&
        selection.selectedScreenData.promptFolderId &&
        !(selection.selectedScreen === 'prompt-template-folders'
          ? validPromptTemplateFolderIds
          : validPromptTaskFolderIds
        ).has(selection.selectedScreenData.promptFolderId)
      ) {
        resetWorkspaceScreenSelection(workspaceId)
      }
      if (
        workspaceRow.lastPromptTaskFolderId &&
        !validPromptTaskFolderIds.has(workspaceRow.lastPromptTaskFolderId)
      ) {
        db.prepare(
          'UPDATE workspace_ui_state SET last_prompt_task_folder_id = NULL WHERE workspace_id = ?'
        ).run(workspaceId)
      }
      if (
        workspaceRow.lastPromptTemplateFolderId &&
        !validPromptTemplateFolderIds.has(workspaceRow.lastPromptTemplateFolderId)
      ) {
        db.prepare(
          'UPDATE workspace_ui_state SET last_prompt_template_folder_id = NULL WHERE workspace_id = ?'
        ).run(workspaceId)
      }
    })
    cleanup()
  }
}
