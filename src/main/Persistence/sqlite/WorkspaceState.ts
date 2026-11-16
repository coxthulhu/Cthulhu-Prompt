import type { SystemSettings } from '@shared/domain/settings/SystemSettings'
import type { PromptStatusFolderId } from '@shared/domain/prompt/Prompt'
import type { WindowPersistence } from './UserPersistenceDataAccess'
import type { CollectionEntryRef } from '@shared/domain/OrderContainer'
import type { WorkspaceScreenSelection } from '@shared/domain/user-persistence/UserPersistence'
import type { TabSessionUserState, TabSessionMachineState } from './TabSessionPersistence'

/** Legacy collection records retained only as a migration source. */
type LegacyCollectionUiState = {
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

/** Whether a state type can follow the user to another machine. */
export enum StorageScope {
  MachineSpecific = 'machine-specific',
  UserSpecific = 'user-specific'
}

/** JSON payloads stored independently of their workspace and entity identity. */
export type WorkspaceStateData = {
  'application-user': {
    hasShownWelcome: boolean
    /** Shared sidebar expansion preference, independent of machine geometry. */
    appSidebarExpanded: boolean
    /** Portable application-wide mockup selection. */
    selectedMockupId?: string | null
  }
  'application-machine': {
    lastWorkspaceInfoPath: string | null
    appSidebarWidthPx: number
    settingsCollapsedSectionIds: string[]
    settingsScrollTopPx: number
    singlePromptNoteFraction: number
    selectedTabId: string | null
  }
  'workspace-dialog': { directory: string | null }
  window: WindowPersistence
  'system-settings': SystemSettings
  /** Legacy import source, removed after tab-session conversion commits. */
  'workspace-navigation': WorkspaceScreenSelection & { lastCollectionIdByProject: Record<string, string | null> }
  'tab-session-user': TabSessionUserState
  'tab-session-machine': TabSessionMachineState
  /** User-owned project order, keyed by workspace. */
  'project-order': { ids: string[] }
  /** Combined task and template order, keyed by project. */
  'collection-order': { entries: CollectionEntryRef[] }
  /** Legacy favorites records removed when their workspace is loaded. */
  'collection-favorites': { ids: string[] }
  'collection-user': Omit<LegacyCollectionUiState, 'workspaceId' | 'contentOwnerId' | 'scrollTopByMode'>
  'collection-machine': Pick<LegacyCollectionUiState, 'scrollTopByMode'>
  'accordion-user': { sections: Array<{ id: string; isExpanded: boolean }> }
  'accordion-machine': { heights: Record<string, number> }
  /** Portable visibility belonging only to an attached note. */
  'attached-note': { visible: boolean }
  'markdown-editor': { editorViewStateJson: string }
}

/** Known persisted state types; each has exactly one storage classification. */
export type WorkspaceStateType = keyof WorkspaceStateData

/** Classification belongs to the state type, never to an individual caller. */
export const WORKSPACE_STATE_SCOPES = {
  'application-user': StorageScope.UserSpecific,
  'application-machine': StorageScope.MachineSpecific,
  'workspace-dialog': StorageScope.MachineSpecific,
  window: StorageScope.MachineSpecific,
  'system-settings': StorageScope.UserSpecific,
  'workspace-navigation': StorageScope.UserSpecific,
  'tab-session-user': StorageScope.UserSpecific,
  'tab-session-machine': StorageScope.MachineSpecific,
  'project-order': StorageScope.UserSpecific,
  'collection-order': StorageScope.UserSpecific,
  'collection-favorites': StorageScope.UserSpecific,
  'collection-user': StorageScope.UserSpecific,
  'collection-machine': StorageScope.MachineSpecific,
  'accordion-user': StorageScope.UserSpecific,
  'accordion-machine': StorageScope.MachineSpecific,
  'attached-note': StorageScope.UserSpecific,
  'markdown-editor': StorageScope.MachineSpecific
} satisfies Record<WorkspaceStateType, StorageScope>
