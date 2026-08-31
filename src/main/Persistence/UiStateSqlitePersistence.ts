import {
  createMarkdownContentUiStateKey,
  type MarkdownContentUiState
} from '@shared/MarkdownContentUiState'
import {
  USER_PERSISTENCE_ID,
  parseWorkspaceAccordionViewEntry,
  parseWorkspaceScreenSelection,
  type UserPersistence,
  type WorkspacePersistence
} from '@shared/UserPersistence'
import type {
  AccordionUiState,
  CategoryDescriptionEditorUiState,
  WorkspacePromptFolderUiState,
  WorkspaceUiState
} from '@shared/UiState'
import { MarkdownContentUiStateDataAccess } from '../DataAccess/MarkdownContentUiStateDataAccess'
import { SqliteDataAccess } from '../DataAccess/SqliteDataAccess'
import { UserPersistenceDataAccess } from '../DataAccess/UserPersistenceDataAccess'
import type { SqlitePersistenceLayer } from './PersistenceTypes'

/** Empty location metadata used by authoritative records stored directly in SQLite. */
export type SqlitePersistenceFields = Record<string, never>

/** Two workspace-scoped ID components decoded from a composite authoritative key. */
type WorkspaceCompositeKey = {
  workspaceId: string
  localId: string
}

/** SQLite row containing workspace screen-selection state. */
type WorkspaceUiStateRow = {
  selectedScreen: string
  selectedScreenDataJson: string | null
  lastPromptFolderId: string | null
}

/** SQLite row containing one prompt-folder screen view state. */
type WorkspacePromptFolderUiStateRow = {
  workspaceId: string
  contentOwnerId: string
  selectedEntryId: string
  treeIsExpanded: number
  detailsSectionIsExpanded: number
  contentSectionIsExpanded: number
}

/** SQLite row containing one serialized accordion state. */
type AccordionUiStateRow = {
  workspaceId: string
  persistenceId: string
  sectionsJson: string
}

/** SQLite row containing one category-description editor state. */
type CategoryDescriptionEditorUiStateRow = CategoryDescriptionEditorUiState

/** Splits a workspace-scoped authoritative key at its first separator. */
const parseWorkspaceCompositeKey = (id: string): WorkspaceCompositeKey => {
  /** Separator between the workspace ID and collection-local ID. */
  const separatorIndex = id.indexOf(':')
  if (separatorIndex <= 0 || separatorIndex === id.length - 1) {
    throw new Error(`Invalid workspace-scoped UI-state ID: ${id}`)
  }
  return {
    workspaceId: id.slice(0, separatorIndex),
    localId: id.slice(separatorIndex + 1)
  }
}

/** Parses nullable JSON stored for one workspace screen selection. */
const parseJson = (value: string | null): unknown => {
  if (value === null) return null
  try {
    return JSON.parse(value)
  } catch {
    return undefined
  }
}

/** SQLite query/command adapter for the singleton user persistence record. */
export const userPersistenceSqlitePersistence: SqlitePersistenceLayer<
  UserPersistence,
  SqlitePersistenceFields
> = {
  kind: 'sqlite',
  query: (id) =>
    id === USER_PERSISTENCE_ID ? UserPersistenceDataAccess.readUserPersistence() : null,
  command: (_id, transition) => {
    if (!transition.after) throw new Error('User persistence cannot be deleted')
    UserPersistenceDataAccess.updateUserPersistence(transition.after.data)
  }
}

/** SQLite query/command adapter for the legacy aggregate workspace persistence record. */
export const workspacePersistenceSqlitePersistence: SqlitePersistenceLayer<
  WorkspacePersistence,
  SqlitePersistenceFields
> = {
  kind: 'sqlite',
  query: (workspaceId) => UserPersistenceDataAccess.readWorkspacePersistence(workspaceId),
  command: (workspaceId, transition) => {
    if (!transition.after) {
      /** Database owning the four legacy aggregate workspace tables. */
      const db = SqliteDataAccess.getDatabase()
      db.prepare('DELETE FROM workspace_ui_state WHERE workspace_id = ?').run(workspaceId)
      db.prepare('DELETE FROM prompt_folder_view_state WHERE workspace_id = ?').run(workspaceId)
      db.prepare('DELETE FROM category_description_editor_view_state WHERE workspace_id = ?').run(
        workspaceId
      )
      db.prepare('DELETE FROM accordion_view_state WHERE workspace_id = ?').run(workspaceId)
      return
    }
    UserPersistenceDataAccess.updateWorkspacePersistence({
      ...transition.after.data,
      workspaceId
    })
  }
}

/** SQLite query/command adapter for workspace-level UI state. */
export const workspaceUiStateSqlitePersistence: SqlitePersistenceLayer<
  WorkspaceUiState,
  SqlitePersistenceFields
> = {
  kind: 'sqlite',
  query: (workspaceId) => {
    /** Stored workspace-level UI state selected by its workspace key. */
    const row = SqliteDataAccess.getDatabase()
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
    if (!row) return null
    /** Validated discriminated screen selection stored in the row. */
    const selection = parseWorkspaceScreenSelection(
      row.selectedScreen,
      parseJson(row.selectedScreenDataJson)
    )
    return selection
      ? { workspaceId, ...selection, lastPromptFolderId: row.lastPromptFolderId }
      : null
  },
  command: (workspaceId, transition) => {
    /** Database receiving the workspace-level UI-state command. */
    const db = SqliteDataAccess.getDatabase()
    if (!transition.after) {
      db.prepare('DELETE FROM workspace_ui_state WHERE workspace_id = ?').run(workspaceId)
      return
    }
    /** Authoritative workspace UI state written by the command. */
    const uiState = transition.after.data
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
      workspaceId,
      uiState.selectedScreen,
      uiState.selectedScreenData === null ? null : JSON.stringify(uiState.selectedScreenData),
      uiState.lastPromptFolderId
    )
  }
}

/** SQLite query/command adapter for prompt-folder view UI state. */
export const workspacePromptFolderUiStateSqlitePersistence: SqlitePersistenceLayer<
  WorkspacePromptFolderUiState,
  SqlitePersistenceFields
> = {
  kind: 'sqlite',
  query: (id) => {
    /** Composite workspace and content-owner key decoded for the SQL query. */
    const { workspaceId, localId: contentOwnerId } = parseWorkspaceCompositeKey(id)
    /** Stored prompt-folder view state selected by its composite key. */
    const row = SqliteDataAccess.getDatabase()
      .prepare(
        `
        SELECT
          workspace_id AS workspaceId,
          content_owner_id AS contentOwnerId,
          selected_entry_id AS selectedEntryId,
          tree_is_expanded AS treeIsExpanded,
          details_section_is_expanded AS detailsSectionIsExpanded,
          content_section_is_expanded AS contentSectionIsExpanded
        FROM prompt_folder_view_state
        WHERE workspace_id = ? AND content_owner_id = ?
        `
      )
      .get(workspaceId, contentOwnerId) as WorkspacePromptFolderUiStateRow | undefined
    return row
      ? {
          workspaceId: row.workspaceId,
          contentOwnerId: row.contentOwnerId,
          selectedEntryId: row.selectedEntryId,
          treeIsExpanded: row.treeIsExpanded !== 0,
          detailsSectionIsExpanded: row.detailsSectionIsExpanded !== 0,
          contentSectionIsExpanded: row.contentSectionIsExpanded !== 0
        }
      : null
  },
  command: (id, transition) => {
    /** Composite workspace and content-owner key decoded for the SQL command. */
    const { workspaceId, localId: contentOwnerId } = parseWorkspaceCompositeKey(id)
    /** Database receiving the prompt-folder UI-state command. */
    const db = SqliteDataAccess.getDatabase()
    if (!transition.after) {
      db.prepare(
        'DELETE FROM prompt_folder_view_state WHERE workspace_id = ? AND content_owner_id = ?'
      ).run(workspaceId, contentOwnerId)
      return
    }
    /** Authoritative prompt-folder view state written by the command. */
    const uiState = transition.after.data
    db.prepare(
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
      ON CONFLICT(workspace_id, content_owner_id) DO UPDATE SET
        selected_entry_id = excluded.selected_entry_id,
        tree_is_expanded = excluded.tree_is_expanded,
        details_section_is_expanded = excluded.details_section_is_expanded,
        content_section_is_expanded = excluded.content_section_is_expanded
      `
    ).run(
      workspaceId,
      contentOwnerId,
      uiState.selectedEntryId,
      uiState.treeIsExpanded ? 1 : 0,
      uiState.detailsSectionIsExpanded ? 1 : 0,
      uiState.contentSectionIsExpanded ? 1 : 0
    )
  }
}

/** SQLite query/command adapter for one accordion UI-state record. */
export const accordionUiStateSqlitePersistence: SqlitePersistenceLayer<
  AccordionUiState,
  SqlitePersistenceFields
> = {
  kind: 'sqlite',
  query: (id) => {
    /** Composite workspace and persistence key decoded for the SQL query. */
    const { workspaceId, localId: persistenceId } = parseWorkspaceCompositeKey(id)
    /** Stored accordion UI state selected by its composite key. */
    const row = SqliteDataAccess.getDatabase()
      .prepare(
        `
        SELECT
          workspace_id AS workspaceId,
          persistence_id AS persistenceId,
          sections_json AS sectionsJson
        FROM accordion_view_state
        WHERE workspace_id = ? AND persistence_id = ?
        `
      )
      .get(workspaceId, persistenceId) as AccordionUiStateRow | undefined
    if (!row) return null
    /** Validated accordion section state decoded from SQLite JSON. */
    const parsed = parseWorkspaceAccordionViewEntry({
      persistenceId: row.persistenceId,
      sections: parseJson(row.sectionsJson)
    })
    return parsed ? { workspaceId: row.workspaceId, ...parsed } : null
  },
  command: (id, transition) => {
    /** Composite workspace and persistence key decoded for the SQL command. */
    const { workspaceId, localId: persistenceId } = parseWorkspaceCompositeKey(id)
    /** Database receiving the accordion UI-state command. */
    const db = SqliteDataAccess.getDatabase()
    if (!transition.after) {
      db.prepare(
        'DELETE FROM accordion_view_state WHERE workspace_id = ? AND persistence_id = ?'
      ).run(workspaceId, persistenceId)
      return
    }
    db.prepare(
      `
      INSERT INTO accordion_view_state (workspace_id, persistence_id, sections_json)
      VALUES (?, ?, ?)
      ON CONFLICT(workspace_id, persistence_id) DO UPDATE SET
        sections_json = excluded.sections_json
      `
    ).run(workspaceId, persistenceId, JSON.stringify(transition.after.data.sections))
  }
}

/** SQLite query/command adapter for one category-description editor UI-state record. */
export const categoryDescriptionEditorUiStateSqlitePersistence: SqlitePersistenceLayer<
  CategoryDescriptionEditorUiState,
  SqlitePersistenceFields
> = {
  kind: 'sqlite',
  query: (id) => {
    /** Composite workspace and category key decoded for the SQL query. */
    const { workspaceId, localId: categoryId } = parseWorkspaceCompositeKey(id)
    return (SqliteDataAccess.getDatabase()
      .prepare(
        `
        SELECT
          workspace_id AS workspaceId,
          category_id AS categoryId,
          editor_view_state_json AS editorViewStateJson
        FROM category_description_editor_view_state
        WHERE workspace_id = ? AND category_id = ?
        `
      )
      .get(workspaceId, categoryId) as CategoryDescriptionEditorUiStateRow | undefined) ?? null
  },
  command: (id, transition) => {
    /** Composite workspace and category key decoded for the SQL command. */
    const { workspaceId, localId: categoryId } = parseWorkspaceCompositeKey(id)
    /** Database receiving the category-description UI-state command. */
    const db = SqliteDataAccess.getDatabase()
    if (!transition.after) {
      db.prepare(
        `DELETE FROM category_description_editor_view_state
         WHERE workspace_id = ? AND category_id = ?`
      ).run(workspaceId, categoryId)
      return
    }
    db.prepare(
      `
      INSERT INTO category_description_editor_view_state (
        workspace_id,
        category_id,
        editor_view_state_json
      )
      VALUES (?, ?, ?)
      ON CONFLICT(workspace_id, category_id) DO UPDATE SET
        editor_view_state_json = excluded.editor_view_state_json
      `
    ).run(workspaceId, categoryId, transition.after.data.editorViewStateJson)
  }
}

/** SQLite query/command adapter for one markdown-content editor UI-state record. */
export const markdownContentUiStateSqlitePersistence: SqlitePersistenceLayer<
  MarkdownContentUiState,
  SqlitePersistenceFields
> = {
  kind: 'sqlite',
  query: (id) => {
    /** Composite workspace and content key decoded for the SQL query. */
    const { workspaceId, localId: contentId } = parseWorkspaceCompositeKey(id)
    return MarkdownContentUiStateDataAccess.readMarkdownContentUiState(workspaceId, contentId)
  },
  command: (id, transition) => {
    /** Composite workspace and content key decoded for the SQL command. */
    const { workspaceId, localId: contentId } = parseWorkspaceCompositeKey(id)
    if (!transition.after) {
      MarkdownContentUiStateDataAccess.deleteMarkdownContentUiState(workspaceId, contentId)
      return
    }
    /** Authoritative UI-state data normalized to the target's composite identity. */
    const uiState = { ...transition.after.data, workspaceId, contentId }
    if (createMarkdownContentUiStateKey(workspaceId, contentId) !== id) {
      throw new Error(`Markdown UI-state ID does not match its data: ${id}`)
    }
    MarkdownContentUiStateDataAccess.upsertMarkdownContentUiState(uiState)
  }
}
