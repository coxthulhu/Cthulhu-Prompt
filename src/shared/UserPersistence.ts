import type { IpcResult } from './IpcResult'
import type { RevisionEnvelope, RevisionPayloadEntity } from './Revision'

export type UserPersistence = {
  lastWorkspaceInfoPath: string | null
  appSidebarWidthPx: number
}

export const DEFAULT_USER_PERSISTENCE: UserPersistence = {
  lastWorkspaceInfoPath: null,
  appSidebarWidthPx: 275
}

export const USER_PERSISTENCE_ID = 'user-persistence'

export type PersistedWorkspaceScreen =
  | 'home'
  | 'settings'
  | 'mockups'
  | 'test-screen'
  | 'prompt-folders'

export type WorkspaceScreenSelection =
  | {
      selectedScreen: 'home'
      selectedScreenData: null
    }
  | {
      selectedScreen: 'settings'
      selectedScreenData: null
    }
  | {
      selectedScreen: 'test-screen'
      selectedScreenData: null
    }
  | {
      selectedScreen: 'mockups'
      selectedScreenData: {
        mockupId: string | null
      }
    }
  | {
      selectedScreen: 'prompt-folders'
      selectedScreenData: {
        promptFolderId: string | null
      }
    }

/** Persisted view state for one root-content or category owner on the prompt-folder screen. */
export type WorkspacePromptFolderViewEntry = {
  contentOwnerId: string
  selectedEntryId: string
  treeIsExpanded: boolean
  detailsSectionIsExpanded: boolean
  contentSectionIsExpanded: boolean
  categoryDescriptionEditorViewStateJson: string | null
}

export type WorkspacePersistence = WorkspaceScreenSelection & {
  workspaceId: string
  lastPromptFolderId: string | null
  promptFolderViewEntries: WorkspacePromptFolderViewEntry[]
}

export const isWorkspaceScreenSelectionSame = (
  left: WorkspaceScreenSelection,
  right: WorkspaceScreenSelection
): boolean => {
  if (left.selectedScreen !== right.selectedScreen) {
    return false
  }

  if (left.selectedScreen === 'prompt-folders' && right.selectedScreen === 'prompt-folders') {
    return left.selectedScreenData.promptFolderId === right.selectedScreenData.promptFolderId
  }

  if (left.selectedScreen === 'mockups' && right.selectedScreen === 'mockups') {
    return left.selectedScreenData.mockupId === right.selectedScreenData.mockupId
  }

  return true
}

export const createDefaultWorkspacePersistence = (workspaceId: string): WorkspacePersistence => {
  return {
    workspaceId,
    selectedScreen: 'home',
    selectedScreenData: null,
    lastPromptFolderId: null,
    promptFolderViewEntries: []
  }
}

/** Clones prompt-folder screen view entries for serialization. */
export const cloneWorkspacePromptFolderViewEntries = (
  entries: WorkspacePromptFolderViewEntry[]
): WorkspacePromptFolderViewEntry[] => {
  return entries.map((entry) => ({
    contentOwnerId: entry.contentOwnerId,
    selectedEntryId: entry.selectedEntryId,
    treeIsExpanded: entry.treeIsExpanded,
    detailsSectionIsExpanded: entry.detailsSectionIsExpanded,
    contentSectionIsExpanded: entry.contentSectionIsExpanded,
    categoryDescriptionEditorViewStateJson: entry.categoryDescriptionEditorViewStateJson
  }))
}

export const toSerializableWorkspacePersistence = (
  workspacePersistence: WorkspacePersistence
): WorkspacePersistence => {
  return {
    workspaceId: workspacePersistence.workspaceId,
    selectedScreen: workspacePersistence.selectedScreen,
    selectedScreenData: workspacePersistence.selectedScreenData,
    lastPromptFolderId: workspacePersistence.lastPromptFolderId,
    promptFolderViewEntries: cloneWorkspacePromptFolderViewEntries(
      workspacePersistence.promptFolderViewEntries
    )
  } as WorkspacePersistence
}

export const LOAD_USER_PERSISTENCE_CHANNEL = 'load-user-persistence'
export const LOAD_WORKSPACE_PERSISTENCE_CHANNEL = 'load-workspace-persistence'
export const UPDATE_USER_PERSISTENCE_CHANNEL = 'update-user-persistence'
export const UPDATE_WORKSPACE_PERSISTENCE_CHANNEL = 'update-workspace-persistence'

export type LoadWorkspacePersistenceRequest = {
  workspaceId: string
}

export type LoadUserPersistenceResult = IpcResult<{
  userPersistence: RevisionEnvelope<UserPersistence>
}>

export type UserPersistenceRevisionPayload = {
  userPersistence: RevisionPayloadEntity<UserPersistence>
}

export type UserPersistenceRevisionResponsePayload = {
  userPersistence: RevisionEnvelope<UserPersistence>
}

export type WorkspacePersistenceRevisionPayload = {
  workspacePersistence: RevisionPayloadEntity<WorkspacePersistence>
}

export type WorkspacePersistenceRevisionResponsePayload = {
  workspacePersistence: RevisionEnvelope<WorkspacePersistence>
}

export type LoadWorkspacePersistenceResult = IpcResult<{
  workspacePersistence: RevisionEnvelope<WorkspacePersistence>
}>

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export const parseUserPersistence = (value: unknown): UserPersistence | null => {
  if (!isRecord(value)) {
    return null
  }

  const lastWorkspaceInfoPath = value.lastWorkspaceInfoPath
  if (lastWorkspaceInfoPath !== null && typeof lastWorkspaceInfoPath !== 'string') {
    return null
  }

  const appSidebarWidthPx =
    typeof value.appSidebarWidthPx === 'number'
      ? Math.round(value.appSidebarWidthPx)
      : DEFAULT_USER_PERSISTENCE.appSidebarWidthPx

  return {
    lastWorkspaceInfoPath,
    appSidebarWidthPx
  }
}

const parsePersistedWorkspaceScreen = (value: unknown): PersistedWorkspaceScreen | null => {
  if (
    value === 'home' ||
    value === 'settings' ||
    value === 'mockups' ||
    value === 'test-screen' ||
    value === 'prompt-folders'
  ) {
    return value
  }

  return null
}

export const parseWorkspaceScreenSelection = (
  selectedScreenValue: unknown,
  selectedScreenData: unknown
): WorkspaceScreenSelection | null => {
  const selectedScreen = parsePersistedWorkspaceScreen(selectedScreenValue)
  if (!selectedScreen) {
    return null
  }

  if (
    selectedScreen === 'home' ||
    selectedScreen === 'settings' ||
    selectedScreen === 'test-screen'
  ) {
    return selectedScreenData === null ? { selectedScreen, selectedScreenData } : null
  }

  if (selectedScreen === 'mockups') {
    if (!isRecord(selectedScreenData)) {
      return null
    }

    const mockupId = selectedScreenData.mockupId
    if (mockupId !== null && typeof mockupId !== 'string') {
      return null
    }

    return {
      selectedScreen,
      selectedScreenData: {
        mockupId
      }
    }
  }

  if (!isRecord(selectedScreenData)) {
    return null
  }

  const promptFolderId = selectedScreenData.promptFolderId
  if (promptFolderId !== null && typeof promptFolderId !== 'string') {
    return null
  }

  return {
    selectedScreen,
    selectedScreenData: {
      promptFolderId
    }
  }
}

/** Parses one persisted prompt-folder screen view entry. */
const parseWorkspacePromptFolderViewEntry = (
  value: unknown
): WorkspacePromptFolderViewEntry | null => {
  if (!isRecord(value)) {
    return null
  }

  if (typeof value.contentOwnerId !== 'string' || typeof value.selectedEntryId !== 'string') {
    return null
  }

  const categoryDescriptionEditorViewStateJson =
    value.categoryDescriptionEditorViewStateJson ?? null
  if (
    categoryDescriptionEditorViewStateJson !== null &&
    typeof categoryDescriptionEditorViewStateJson !== 'string'
  ) {
    return null
  }

  const detailsSectionIsExpanded =
    value.detailsSectionIsExpanded === undefined
      ? false
      : typeof value.detailsSectionIsExpanded === 'boolean'
        ? value.detailsSectionIsExpanded
        : null
  if (detailsSectionIsExpanded === null) {
    return null
  }

  const treeIsExpanded =
    value.treeIsExpanded === undefined
      ? true
      : typeof value.treeIsExpanded === 'boolean'
        ? value.treeIsExpanded
        : null
  if (treeIsExpanded === null) {
    return null
  }

  const contentSectionIsExpanded =
    value.contentSectionIsExpanded === undefined
      ? true
      : typeof value.contentSectionIsExpanded === 'boolean'
        ? value.contentSectionIsExpanded
        : null
  if (contentSectionIsExpanded === null) {
    return null
  }

  return {
    contentOwnerId: value.contentOwnerId,
    selectedEntryId: value.selectedEntryId,
    treeIsExpanded,
    detailsSectionIsExpanded,
    contentSectionIsExpanded,
    categoryDescriptionEditorViewStateJson
  }
}

/** Parses the persisted prompt-folder screen view-entry array. */
const parseWorkspacePromptFolderViewEntries = (
  value: unknown
): WorkspacePromptFolderViewEntry[] => {
  if (!Array.isArray(value)) {
    return []
  }

  const parsedEntries: WorkspacePromptFolderViewEntry[] = []

  for (const entry of value) {
    const parsedEntry = parseWorkspacePromptFolderViewEntry(entry)
    if (!parsedEntry) {
      continue
    }

    parsedEntries.push(parsedEntry)
  }

  return parsedEntries
}

export const parseWorkspacePersistence = (
  value: unknown,
  workspaceId: string
): WorkspacePersistence | null => {
  if (!isRecord(value)) {
    return null
  }

  const workspaceScreenSelection = parseWorkspaceScreenSelection(
    value.selectedScreen,
    value.selectedScreenData
  )
  if (!workspaceScreenSelection) {
    return null
  }

  const promptFolderViewEntries = parseWorkspacePromptFolderViewEntries(
    value.promptFolderViewEntries
  )
  const lastPromptFolderId = value.lastPromptFolderId ?? null
  if (lastPromptFolderId !== null && typeof lastPromptFolderId !== 'string') {
    return null
  }

  return {
    workspaceId,
    ...workspaceScreenSelection,
    lastPromptFolderId,
    promptFolderViewEntries
  } as WorkspacePersistence
}
