import type { DomainChange, DomainPlanner } from './DomainChanges'
import {
  createAccordionUiStateKey,
  createCategoryDescriptionEditorUiStateKey,
  createWorkspacePromptFolderUiStateKey,
  type AccordionUiState,
  type CategoryDescriptionEditorUiState,
  type WorkspacePromptFolderUiState,
  type WorkspaceUiState
} from './UiState'
import {
  parseWorkspaceAccordionSections,
  parseWorkspaceScreenSelection
} from './UserPersistence'

/** Command that sets or removes one category-description editor view state. */
export type SetCategoryDescriptionEditorUiStateDomainCommand = {
  workspaceId: string
  categoryId: string
  editorViewStateJson: string | null
}

/** Builds an insert or update plan for one complete authoritative UI-state record. */
const planUiStateUpsert = <
  TEntityType extends
    | 'workspaceUiState'
    | 'workspacePromptFolderUiState'
    | 'accordionUiState',
  TCommand extends WorkspaceUiState | WorkspacePromptFolderUiState | AccordionUiState
>(
  state: Parameters<DomainPlanner<TCommand>>[0],
  entityType: TEntityType,
  id: string,
  command: TCommand
): DomainChange[] => {
  /** Existing authoritative record deciding whether the plan inserts or updates. */
  const existing = state.get(entityType, id)
  return existing
    ? [
        {
          type: 'update',
          entityType,
          id,
          recipe: (draft) => {
            Object.assign(draft, command)
          }
        } as DomainChange
      ]
    : [{ type: 'insert', entityType, id, data: command } as DomainChange]
}

/** Strict runtime parser for workspace-level UI-state replacement commands. */
export const parseSetWorkspaceUiStateDomainCommand = (
  value: unknown
): WorkspaceUiState | null => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null
  /** Raw command fields validated without allowing additional properties. */
  const record = value as Record<string, unknown>
  if (Object.keys(record).length !== 4 || typeof record.workspaceId !== 'string') return null
  /** Validated discriminated workspace screen selection. */
  const selection = parseWorkspaceScreenSelection(
    record.selectedScreen,
    record.selectedScreenData
  )
  if (
    !selection ||
    (record.lastPromptFolderId !== null && typeof record.lastPromptFolderId !== 'string')
  ) {
    return null
  }
  return {
    workspaceId: record.workspaceId,
    ...selection,
    lastPromptFolderId: record.lastPromptFolderId
  }
}

/** Strict runtime parser for prompt-folder view UI-state replacement commands. */
export const parseSetWorkspacePromptFolderUiStateDomainCommand = (
  value: unknown
): WorkspacePromptFolderUiState | null => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null
  /** Raw command fields validated without allowing additional properties. */
  const record = value as Record<string, unknown>
  if (
    Object.keys(record).length !== 6 ||
    typeof record.workspaceId !== 'string' ||
    typeof record.contentOwnerId !== 'string' ||
    typeof record.selectedEntryId !== 'string' ||
    typeof record.treeIsExpanded !== 'boolean' ||
    typeof record.detailsSectionIsExpanded !== 'boolean' ||
    typeof record.contentSectionIsExpanded !== 'boolean'
  ) {
    return null
  }
  return record as WorkspacePromptFolderUiState
}

/** Strict runtime parser for complete accordion UI-state replacement commands. */
export const parseSetAccordionUiStateDomainCommand = (
  value: unknown
): AccordionUiState | null => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null
  /** Raw command fields validated without allowing additional properties. */
  const record = value as Record<string, unknown>
  if (
    Object.keys(record).length !== 3 ||
    typeof record.workspaceId !== 'string' ||
    typeof record.persistenceId !== 'string'
  ) {
    return null
  }
  /** Validated accordion sections retained in persisted order. */
  const sections = parseWorkspaceAccordionSections(record.sections)
  return sections ? { workspaceId: record.workspaceId, persistenceId: record.persistenceId, sections } : null
}

/** Strict runtime parser for nullable category-editor UI-state commands. */
export const parseSetCategoryDescriptionEditorUiStateDomainCommand = (
  value: unknown
): SetCategoryDescriptionEditorUiStateDomainCommand | null => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null
  /** Raw command fields validated without allowing additional properties. */
  const record = value as Record<string, unknown>
  if (
    Object.keys(record).length !== 3 ||
    typeof record.workspaceId !== 'string' ||
    typeof record.categoryId !== 'string' ||
    (record.editorViewStateJson !== null && typeof record.editorViewStateJson !== 'string')
  ) {
    return null
  }
  return record as SetCategoryDescriptionEditorUiStateDomainCommand
}

/** Plans one insert-or-update workspace-level UI-state replacement. */
export const planSetWorkspaceUiStateDomainMutation: DomainPlanner<WorkspaceUiState> = (
  state,
  command
) => planUiStateUpsert(state, 'workspaceUiState', command.workspaceId, command)

/** Plans one insert-or-update prompt-folder view UI-state replacement. */
export const planSetWorkspacePromptFolderUiStateDomainMutation: DomainPlanner<WorkspacePromptFolderUiState> = (
  state,
  command
) =>
  planUiStateUpsert(
    state,
    'workspacePromptFolderUiState',
    createWorkspacePromptFolderUiStateKey(command.workspaceId, command.contentOwnerId),
    command
  )

/** Plans one insert-or-update accordion UI-state replacement. */
export const planSetAccordionUiStateDomainMutation: DomainPlanner<AccordionUiState> = (
  state,
  command
) =>
  planUiStateUpsert(
    state,
    'accordionUiState',
    createAccordionUiStateKey(command.workspaceId, command.persistenceId),
    command
  )

/** Plans one insert, update, or optional delete for category-editor UI state. */
export const planSetCategoryDescriptionEditorUiStateDomainMutation: DomainPlanner<SetCategoryDescriptionEditorUiStateDomainCommand> = (
  state,
  command
) => {
  /** Composite authoritative key shared by renderer and SQLite persistence. */
  const id = createCategoryDescriptionEditorUiStateKey(
    command.workspaceId,
    command.categoryId
  )
  if (command.editorViewStateJson === null) {
    return [{ type: 'delete', entityType: 'categoryDescriptionEditorUiState', id }]
  }
  /** Complete persisted category editor state represented by the command. */
  const uiState: CategoryDescriptionEditorUiState = {
    workspaceId: command.workspaceId,
    categoryId: command.categoryId,
    editorViewStateJson: command.editorViewStateJson
  }
  /** Existing authoritative editor state deciding between insert and update. */
  const existing = state.get('categoryDescriptionEditorUiState', id)
  return existing
    ? [
        {
          type: 'update',
          entityType: 'categoryDescriptionEditorUiState',
          id,
          recipe: (draft) => {
            Object.assign(draft, uiState)
          }
        }
      ]
    : [{ type: 'insert', entityType: 'categoryDescriptionEditorUiState', id, data: uiState }]
}
