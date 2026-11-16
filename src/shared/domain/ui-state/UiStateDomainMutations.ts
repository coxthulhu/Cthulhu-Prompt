import type { DomainPlanner } from '@shared/domain/DomainChanges'
import type { WorkspaceUiState } from './UiState'
import { isWorkspaceTab, isCollectionViewState } from './TabSession'

/** Strict runtime parser for workspace-level UI-state replacement commands. */
export const parseSetWorkspaceUiStateDomainCommand = (
  value: unknown
): WorkspaceUiState | null => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null
  /** Raw command fields validated without allowing additional properties. */
  const record = value as Record<string, unknown>
  if (Object.keys(record).length !== 4 || typeof record.workspaceId !== 'string') return null
  if (!Array.isArray(record.tabs) || !record.tabs.every(isWorkspaceTab) ||
    typeof record.selectedTabId !== 'string' ||
    typeof record.lastClosedCollections !== 'object' || record.lastClosedCollections === null ||
    Array.isArray(record.lastClosedCollections) || !Object.values(record.lastClosedCollections).every(isCollectionViewState)) return null
  return record as WorkspaceUiState
}

/** Replaces one complete workspace tab session through the shared mutation framework. */
export const planSetWorkspaceUiStateDomainMutation: DomainPlanner<WorkspaceUiState> = (state, command) =>
  state.get('workspaceUiState', command.workspaceId)
    ? [{ type: 'update', entityType: 'workspaceUiState', id: command.workspaceId, recipe: (draft) => { Object.assign(draft, command) } }]
    : [{ type: 'insert', entityType: 'workspaceUiState', id: command.workspaceId, data: command }]
