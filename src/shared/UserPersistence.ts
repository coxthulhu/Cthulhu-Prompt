import type { IpcResult } from './IpcResult'
import { PROMPT_FOLDER_SETTINGS_FIELDS, type PromptFolderSettingsField } from './PromptFolder'
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

export type WorkspacePromptFolderPromptTreeEntry = {
  promptFolderId: string
  promptTreeEntryId: string
  folderSettingsSectionIsExpanded: boolean
  promptsSectionIsExpanded: boolean
  settingsEditorViewStates: Record<PromptFolderSettingsField, string | null>
}

export type WorkspacePersistence = WorkspaceScreenSelection & {
  workspaceId: string
  lastPromptFolderId: string | null
  promptFolderPromptTreeEntries: WorkspacePromptFolderPromptTreeEntry[]
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
    promptFolderPromptTreeEntries: []
  }
}

export const cloneWorkspacePromptFolderPromptTreeEntries = (
  entries: WorkspacePromptFolderPromptTreeEntry[]
): WorkspacePromptFolderPromptTreeEntry[] => {
  return entries.map((entry) => ({
    promptFolderId: entry.promptFolderId,
    promptTreeEntryId: entry.promptTreeEntryId,
    folderSettingsSectionIsExpanded: entry.folderSettingsSectionIsExpanded,
    promptsSectionIsExpanded: entry.promptsSectionIsExpanded,
    settingsEditorViewStates: copyPromptFolderSettingsEditorViewStates(
      entry.settingsEditorViewStates
    )
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
    promptFolderPromptTreeEntries: cloneWorkspacePromptFolderPromptTreeEntries(
      workspacePersistence.promptFolderPromptTreeEntries
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

export const createEmptyPromptFolderSettingsEditorViewStates = (): Record<
  PromptFolderSettingsField,
  string | null
> => ({
  folderDescription: null,
  folderPrefix: null,
  folderSuffix: null
})

export const copyPromptFolderSettingsEditorViewStates = (
  viewStates: Record<PromptFolderSettingsField, string | null>
): Record<PromptFolderSettingsField, string | null> => ({
  folderDescription: viewStates.folderDescription,
  folderPrefix: viewStates.folderPrefix,
  folderSuffix: viewStates.folderSuffix
})

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

const parseWorkspacePromptFolderPromptTreeEntry = (
  value: unknown
): WorkspacePromptFolderPromptTreeEntry | null => {
  if (!isRecord(value)) {
    return null
  }

  if (typeof value.promptFolderId !== 'string' || typeof value.promptTreeEntryId !== 'string') {
    return null
  }

  const settingsEditorViewStates = createEmptyPromptFolderSettingsEditorViewStates()
  if (value.settingsEditorViewStates !== undefined) {
    if (!isRecord(value.settingsEditorViewStates)) {
      return null
    }

    for (const field of PROMPT_FOLDER_SETTINGS_FIELDS) {
      const viewState = value.settingsEditorViewStates[field]
      if (viewState !== undefined && viewState !== null && typeof viewState !== 'string') {
        return null
      }
      settingsEditorViewStates[field] = viewState ?? null
    }
  } else {
    const legacyViewStateFields: Record<PromptFolderSettingsField, unknown> = {
      folderDescription: value.folderDescriptionEditorViewStateJson,
      folderPrefix: value.folderPrefixEditorViewStateJson,
      folderSuffix: value.folderSuffixEditorViewStateJson
    }

    for (const field of PROMPT_FOLDER_SETTINGS_FIELDS) {
      const viewState = legacyViewStateFields[field]
      if (viewState !== undefined && viewState !== null && typeof viewState !== 'string') {
        return null
      }
      settingsEditorViewStates[field] = viewState ?? null
    }
  }

  const folderSettingsSectionIsExpanded =
    value.folderSettingsSectionIsExpanded === undefined
      ? false
      : typeof value.folderSettingsSectionIsExpanded === 'boolean'
        ? value.folderSettingsSectionIsExpanded
        : null
  if (folderSettingsSectionIsExpanded === null) {
    return null
  }

  const promptsSectionIsExpanded =
    value.promptsSectionIsExpanded === undefined
      ? true
      : typeof value.promptsSectionIsExpanded === 'boolean'
        ? value.promptsSectionIsExpanded
        : null
  if (promptsSectionIsExpanded === null) {
    return null
  }

  return {
    promptFolderId: value.promptFolderId,
    promptTreeEntryId: value.promptTreeEntryId,
    folderSettingsSectionIsExpanded,
    promptsSectionIsExpanded,
    settingsEditorViewStates
  }
}

const parseWorkspacePromptFolderPromptTreeEntries = (
  value: unknown
): WorkspacePromptFolderPromptTreeEntry[] => {
  if (!Array.isArray(value)) {
    return []
  }

  const parsedEntries: WorkspacePromptFolderPromptTreeEntry[] = []

  for (const entry of value) {
    const parsedEntry = parseWorkspacePromptFolderPromptTreeEntry(entry)
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

  const promptFolderPromptTreeEntries = parseWorkspacePromptFolderPromptTreeEntries(
    value.promptFolderPromptTreeEntries
  )
  const lastPromptFolderId = value.lastPromptFolderId ?? null
  if (lastPromptFolderId !== null && typeof lastPromptFolderId !== 'string') {
    return null
  }

  return {
    workspaceId,
    ...workspaceScreenSelection,
    lastPromptFolderId,
    promptFolderPromptTreeEntries
  } as WorkspacePersistence
}
