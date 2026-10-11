import { parseWorkspaceScreenSelection } from '@shared/domain/user-persistence/UserPersistence'
import { SqliteDataAccess } from './SqliteDataAccess'

/** SQLite workspace-level state used during stale-row cleanup. */
type WorkspaceUiStateRow = {
  selectedScreen: string
  selectedScreenDataJson: string | null
  lastPromptTaskCollectionId: string | null
  lastPromptTemplateCollectionId: string | null
}

/** Persisted prompt-collection state for one collection or category owner. */
type PromptCollectionViewRow = {
  contentOwnerId: string
  selectedEntryId: string
  treeIsExpanded: number
  contentSectionIsExpanded: number
  /** Serialized offsets retained during stale-owner cleanup. */
  scrollTopByModeJson: string
  /** Last collection mode retained when stale owners are pruned. */
  selectedMode: string
  /** Collection-specific visibility retained when stale owners are pruned. */
  shownFinalStatusGroupsJson: string
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

/** Resets stale workspace navigation while preserving valid per-kind collection memories. */
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
  /** Removes collection/category UI state whose owner no longer exists. */
  static cleanupWorkspacePromptCollectionUiState(
    workspaceId: string,
    workspacePromptTaskCollectionIds: string[],
    workspacePromptTemplateCollectionIds: string[],
    workspaceCategoryIds: string[]
  ): void {
    /** SQLite database containing split workspace UI state. */
    const db = SqliteDataAccess.getDatabase()
    /** Valid collection IDs used to validate screen and last-collection state. */
    const validPromptTaskCollectionIds = new Set(workspacePromptTaskCollectionIds)
    /** Valid prompt-template collections used to validate template navigation state. */
    const validPromptTemplateCollectionIds = new Set(workspacePromptTemplateCollectionIds)
    /** Every valid collection ID used to retain collection-owned view state. */
    const validPromptCollectionIds = new Set([
      ...workspacePromptTaskCollectionIds,
      ...workspacePromptTemplateCollectionIds
    ])
    /** Valid collection and category IDs used to prune owner-scoped state. */
    const validContentOwnerIds = new Set([...validPromptCollectionIds, ...workspaceCategoryIds])
    /** Atomic cleanup preserving every still-valid row. */
    const cleanup = db.transaction(() => {
      /** Existing owner rows inspected before pruning. */
      const promptCollectionRows = db
        .prepare(
          `SELECT content_owner_id AS contentOwnerId,
                  selected_entry_id AS selectedEntryId,
                  tree_is_expanded AS treeIsExpanded,
                  content_section_is_expanded AS contentSectionIsExpanded,
                  scroll_top_by_mode_json AS scrollTopByModeJson,
                  selected_mode AS selectedMode,
                  shown_final_status_groups_json AS shownFinalStatusGroupsJson
           FROM prompt_collection_view_state WHERE workspace_id = ?`
        )
        .all(workspaceId) as PromptCollectionViewRow[]
      db.prepare('DELETE FROM prompt_collection_view_state WHERE workspace_id = ?').run(workspaceId)
      /** Prepared insert for one retained owner row. */
      const insertPromptCollection = db.prepare(
        `INSERT INTO prompt_collection_view_state (
           workspace_id, content_owner_id, selected_entry_id,
           tree_is_expanded, content_section_is_expanded, scroll_top_by_mode_json,
           selected_mode, shown_final_status_groups_json
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      )
      for (const row of promptCollectionRows) {
        if (!validContentOwnerIds.has(row.contentOwnerId)) continue
        insertPromptCollection.run(
          workspaceId,
          row.contentOwnerId,
          row.selectedEntryId,
          row.treeIsExpanded,
          row.contentSectionIsExpanded,
          row.scrollTopByModeJson,
          row.selectedMode,
          row.shownFinalStatusGroupsJson
        )
      }

      /** Current workspace-level row validated after owner pruning. */
      const workspaceRow = db
        .prepare(
          `SELECT selected_screen AS selectedScreen,
                  selected_screen_data_json AS selectedScreenDataJson,
                  last_prompt_task_collection_id AS lastPromptTaskCollectionId,
                  last_prompt_template_collection_id AS lastPromptTemplateCollectionId
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
        (selection.selectedScreen === 'prompt-task-collections' ||
          selection.selectedScreen === 'prompt-template-collections') &&
        selection.selectedScreenData.promptCollectionId &&
        !(selection.selectedScreen === 'prompt-template-collections'
          ? validPromptTemplateCollectionIds
          : validPromptTaskCollectionIds
        ).has(selection.selectedScreenData.promptCollectionId)
      ) {
        resetWorkspaceScreenSelection(workspaceId)
      }
      if (
        workspaceRow.lastPromptTaskCollectionId &&
        !validPromptTaskCollectionIds.has(workspaceRow.lastPromptTaskCollectionId)
      ) {
        db.prepare(
          'UPDATE workspace_ui_state SET last_prompt_task_collection_id = NULL WHERE workspace_id = ?'
        ).run(workspaceId)
      }
      if (
        workspaceRow.lastPromptTemplateCollectionId &&
        !validPromptTemplateCollectionIds.has(workspaceRow.lastPromptTemplateCollectionId)
      ) {
        db.prepare(
          'UPDATE workspace_ui_state SET last_prompt_template_collection_id = NULL WHERE workspace_id = ?'
        ).run(workspaceId)
      }
    })
    cleanup()
  }
}
