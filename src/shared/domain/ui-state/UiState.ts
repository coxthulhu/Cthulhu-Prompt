import type {
  WorkspaceAccordionSectionViewEntry,
  WorkspaceScreenSelection
} from '@shared/domain/user-persistence/UserPersistence'
import type { IpcResult } from '@shared/ipc/IpcResult'
import type { RevisionEnvelope } from '@shared/ipc/Revision'
import type { PromptStatusFolderId } from '@shared/domain/prompt/Prompt'

/** Persisted screen selection and last-collection state for one workspace. */
export type WorkspaceUiState = WorkspaceScreenSelection & {
  workspaceId: string
  /** Last task-prompt collection selected in this workspace. */
  lastPromptTaskCollectionId: string | null
  /** Last prompt-template collection selected in this workspace. */
  lastPromptTemplateCollectionId: string | null
}

/** Persisted prompt-collection screen state for one collection or category content owner. */
export type WorkspacePromptCollectionUiState = {
  workspaceId: string
  contentOwnerId: string
  selectedEntryId: string
  treeIsExpanded: boolean
  contentSectionIsExpanded: boolean
  /** Last reachable viewport offset for each visited status mode of a collection. */
  scrollTopByMode: Partial<Record<PromptStatusFolderId, number>>
  /** Last selected status mode for this collection. */
  selectedMode: PromptStatusFolderId
  /** Toggleable sidebar sections shown for this collection. */
  shownFinalStatusGroups: Partial<Record<PromptStatusFolderId, boolean>>
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
  lastPromptTaskCollectionId: null,
  lastPromptTemplateCollectionId: null
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
  workspacePromptCollectionUiStates: RevisionEnvelope<WorkspacePromptCollectionUiState>[]
  accordionUiStates: RevisionEnvelope<AccordionUiState>[]
}>

/** Builds the authoritative key for one workspace prompt-collection UI-state record. */
export const createWorkspacePromptCollectionUiStateKey = (
  workspaceId: string,
  contentOwnerId: string
): string => `${workspaceId}:${contentOwnerId}`

/** Builds the authoritative key for one workspace accordion UI-state record. */
export const createAccordionUiStateKey = (
  workspaceId: string,
  persistenceId: string
): string => `${workspaceId}:${persistenceId}`
