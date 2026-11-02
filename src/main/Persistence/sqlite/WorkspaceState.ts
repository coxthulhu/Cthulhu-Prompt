import type { SystemSettings } from '@shared/domain/settings/SystemSettings'
import type { WorkspacePromptCollectionUiState, WorkspaceUiState } from '@shared/domain/ui-state/UiState'
import type { WindowPersistence } from './UserPersistenceDataAccess'
import type { CollectionEntryRef } from '@shared/domain/OrderContainer'

/** Whether a state type can follow the user to another machine. */
export enum StorageScope {
  MachineSpecific = 'machine-specific',
  UserSpecific = 'user-specific'
}

/** JSON payloads stored independently of their workspace and entity identity. */
export type WorkspaceStateData = {
  'application-user': { hasShownWelcome: boolean }
  'application-machine': {
    lastWorkspaceInfoPath: string | null
    appSidebarWidthPx: number
    settingsCollapsedSectionIds: string[]
    settingsScrollTopPx: number
  }
  'workspace-dialog': { directory: string | null }
  window: WindowPersistence
  'system-settings': SystemSettings
  'workspace-navigation': Omit<WorkspaceUiState, 'workspaceId'>
  /** Combined default-project order for task and template collections. */
  'collection-order': { entries: CollectionEntryRef[] }
  /** Ordered favorites remain private to the user and workspace. */
  'collection-favorites': { ids: string[] }
  'collection-user': Omit<WorkspacePromptCollectionUiState, 'workspaceId' | 'contentOwnerId' | 'scrollTopByMode'>
  'collection-machine': Pick<WorkspacePromptCollectionUiState, 'scrollTopByMode'>
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
  'collection-order': StorageScope.UserSpecific,
  'collection-favorites': StorageScope.UserSpecific,
  'collection-user': StorageScope.UserSpecific,
  'collection-machine': StorageScope.MachineSpecific,
  'accordion-user': StorageScope.UserSpecific,
  'accordion-machine': StorageScope.MachineSpecific,
  'attached-note': StorageScope.UserSpecific,
  'markdown-editor': StorageScope.MachineSpecific
} satisfies Record<WorkspaceStateType, StorageScope>
