import {
  createMarkdownContentUiStateKey,
  type MarkdownContentUiState
} from '@shared/domain/ui-state/MarkdownContentUiState'
import {
  USER_PERSISTENCE_ID,
  parseWorkspaceAccordionSections,
  parseWorkspaceScreenSelection,
  type UserPersistence
} from '@shared/domain/user-persistence/UserPersistence'
import type {
  AccordionUiState,
  WorkspacePromptCollectionUiState,
  WorkspaceUiState
} from '@shared/domain/ui-state/UiState'
import { MarkdownContentUiStateDataAccess } from './MarkdownContentUiStateDataAccess'
import { SqliteDataAccess } from './SqliteDataAccess'
import { WorkspaceStateDataAccess } from './WorkspaceStateDataAccess'
import { UserPersistenceDataAccess } from './UserPersistenceDataAccess'
import type { SqlitePersistenceLayer } from '../PersistenceTypes'

/** Empty location metadata used by authoritative records stored directly in SQLite. */
export type SqlitePersistenceFields = Record<string, never>

/** Two workspace-scoped ID components decoded from a composite authoritative key. */
type WorkspaceCompositeKey = {
  workspaceId: string
  localId: string
}

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

/** SQLite adapter for workspace navigation, which follows the user. */
export const workspaceUiStateSqlitePersistence: SqlitePersistenceLayer<WorkspaceUiState, SqlitePersistenceFields> = {
  kind: 'sqlite',
  query: (workspaceId) => {
    /** Navigation payload has no redundant identity fields. */
    const row = WorkspaceStateDataAccess.read(workspaceId, 'workspace-navigation', null)
    if (!row) return null
    /** Existing validation rejects invalid screen selections. */
    const selection = parseWorkspaceScreenSelection(row.selectedScreen, row.selectedScreenData)
    return selection ? { ...row, ...selection, workspaceId } : null
  },
  command: (workspaceId, transition) => {
    if (!transition.after) {
      WorkspaceStateDataAccess.delete(workspaceId, 'workspace-navigation', null)
      return
    }
    /** Identity stays in the key columns rather than the JSON payload. */
    const { workspaceId: _workspaceId, ...state } = transition.after.data
    WorkspaceStateDataAccess.write(workspaceId, 'workspace-navigation', null, state)
  }
}

/** SQLite adapter separating collection choices from machine-local viewport offsets. */
export const workspacePromptCollectionUiStateSqlitePersistence: SqlitePersistenceLayer<WorkspacePromptCollectionUiState, SqlitePersistenceFields> = {
  kind: 'sqlite',
  query: (id) => {
    /** Workspace and owner identify both halves of the record. */
    const { workspaceId, localId: contentOwnerId } = parseWorkspaceCompositeKey(id)
    /** User choices are sufficient to restore a collection on a new machine. */
    const user = WorkspaceStateDataAccess.read(workspaceId, 'collection-user', contentOwnerId)
    return user ? {
      ...user, workspaceId, contentOwnerId,
      scrollTopByMode: WorkspaceStateDataAccess.read(workspaceId, 'collection-machine', contentOwnerId)?.scrollTopByMode ?? {}
    } : null
  },
  command: (id, transition) => {
    /** Both storage scopes share the same workspace and owner. */
    const { workspaceId, localId: contentOwnerId } = parseWorkspaceCompositeKey(id)
    SqliteDataAccess.runTransaction(() => {
      if (!transition.after) {
        WorkspaceStateDataAccess.delete(workspaceId, 'collection-user', contentOwnerId)
        WorkspaceStateDataAccess.delete(workspaceId, 'collection-machine', contentOwnerId)
        return
      }
      /** Split pixel offsets from the portable choices. */
      const { workspaceId: _workspaceId, contentOwnerId: _contentOwnerId, scrollTopByMode, ...user } = transition.after.data
      WorkspaceStateDataAccess.write(workspaceId, 'collection-user', contentOwnerId, user)
      WorkspaceStateDataAccess.write(workspaceId, 'collection-machine', contentOwnerId, { scrollTopByMode })
    })
  }
}

/** SQLite adapter separating ordered accordion expansion from machine-local heights. */
export const accordionUiStateSqlitePersistence: SqlitePersistenceLayer<AccordionUiState, SqlitePersistenceFields> = {
  kind: 'sqlite',
  query: (id) => {
    /** Accordion identity shared by both stored payloads. */
    const { workspaceId, localId: persistenceId } = parseWorkspaceCompositeKey(id)
    /** Ordered section choices determine which sections can be restored. */
    const user = WorkspaceStateDataAccess.read(workspaceId, 'accordion-user', persistenceId)
    if (!user) return null
    /** Missing local heights use equal weights until the user resizes the sections. */
    const heights = WorkspaceStateDataAccess.read(workspaceId, 'accordion-machine', persistenceId)?.heights ?? {}
    /** Reassembled sections retain the existing domain validation. */
    const sections = parseWorkspaceAccordionSections(user.sections.map((section) => ({
      ...section, configuredExpandedHeightPx: heights[section.id] ?? 1
    })))
    return sections ? { workspaceId, persistenceId, sections } : null
  },
  command: (id, transition) => {
    /** Accordion identity shared by both storage scopes. */
    const { workspaceId, localId: persistenceId } = parseWorkspaceCompositeKey(id)
    SqliteDataAccess.runTransaction(() => {
      if (!transition.after) {
        WorkspaceStateDataAccess.delete(workspaceId, 'accordion-user', persistenceId)
        WorkspaceStateDataAccess.delete(workspaceId, 'accordion-machine', persistenceId)
        return
      }
      /** Ordered sections are split without losing collapsed sections' saved heights. */
      const sections = transition.after.data.sections
      WorkspaceStateDataAccess.write(workspaceId, 'accordion-user', persistenceId, {
        sections: sections.map(({ id, isExpanded }) => ({ id, isExpanded }))
      })
      WorkspaceStateDataAccess.write(workspaceId, 'accordion-machine', persistenceId, {
        heights: Object.fromEntries(sections.map((section) => [section.id, section.configuredExpandedHeightPx]))
      })
    })
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
