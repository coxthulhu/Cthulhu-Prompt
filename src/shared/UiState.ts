import type {
  WorkspaceAccordionSectionViewEntry,
  WorkspaceScreenSelection
} from './UserPersistence'
import type { IpcResult } from './IpcResult'
import type { RevisionEnvelope } from './Revision'

/** Persisted screen selection and last-root state for one workspace. */
export type WorkspaceUiState = WorkspaceScreenSelection & {
  workspaceId: string
  /** Last task-prompt root selected in this workspace. */
  lastPromptTaskFolderId: string | null
  /** Last prompt-template root selected in this workspace. */
  lastPromptTemplateFolderId: string | null
}

/** Persisted prompt-folder screen state for one root or category content owner. */
export type WorkspacePromptFolderUiState = {
  workspaceId: string
  contentOwnerId: string
  selectedEntryId: string
  treeIsExpanded: boolean
  contentSectionIsExpanded: boolean
}

/** Persisted section state for one accordion instance in one workspace. */
export type AccordionUiState = {
  workspaceId: string
  persistenceId: string
  sections: WorkspaceAccordionSectionViewEntry[]
}

/** Creates the default workspace-level state used before SQLite contains a row. */
export const createDefaultWorkspaceUiState = (workspaceId: string): WorkspaceUiState => ({
  workspaceId,
  selectedScreen: 'home',
  selectedScreenData: null,
  lastPromptTaskFolderId: null,
  lastPromptTemplateFolderId: null
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
  workspacePromptFolderUiStates: RevisionEnvelope<WorkspacePromptFolderUiState>[]
  accordionUiStates: RevisionEnvelope<AccordionUiState>[]
}>

/** Builds the authoritative key for one workspace prompt-folder UI-state record. */
export const createWorkspacePromptFolderUiStateKey = (
  workspaceId: string,
  contentOwnerId: string
): string => `${workspaceId}:${contentOwnerId}`

/** Builds the authoritative key for one workspace accordion UI-state record. */
export const createAccordionUiStateKey = (
  workspaceId: string,
  persistenceId: string
): string => `${workspaceId}:${persistenceId}`
