import type { IpcResult } from '@shared/ipc/IpcResult'
import type { RevisionEnvelope } from '@shared/ipc/Revision'

import type { CollectionViewState, WorkspaceTab } from './TabSession'

/** Complete tab session and last-closed collection snapshots for one workspace. */
export type WorkspaceUiState = {
  workspaceId: string
  tabs: WorkspaceTab[]
  selectedTabId: string
  lastClosedCollections: Record<string, CollectionViewState>
}

/** Creates the default workspace-level state used before SQLite contains a row. */
export const createDefaultWorkspaceUiState = (workspaceId: string): WorkspaceUiState => ({
  workspaceId,
  tabs: [],
  selectedTabId: 'home',
  lastClosedCollections: {}
})

/** IPC channel that loads every split UI-state collection for one workspace. */
export const LOAD_WORKSPACE_UI_STATE_CHANNEL = 'load-workspace-ui-state'

/** Workspace identity supplied to the split UI-state startup query. */
export type LoadWorkspaceUiStateRequest = {
  workspaceId: string
}

/** Authoritative split UI-state snapshots loaded when a workspace is selected. */
export type LoadWorkspaceUiStateResult = IpcResult<{
  workspaceUiState: RevisionEnvelope<WorkspaceUiState>
}>
