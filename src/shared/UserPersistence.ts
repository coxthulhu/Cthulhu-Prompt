import type { IpcResult } from './IpcResult'
import type { RevisionEnvelope, RevisionPayloadEntity } from './Revision'

export type UserPersistence = {
  lastWorkspacePath: string | null
  appSidebarWidthPx: number
}

export const DEFAULT_USER_PERSISTENCE: UserPersistence = {
  lastWorkspacePath: null,
  appSidebarWidthPx: 275
}

export const USER_PERSISTENCE_ID = 'user-persistence'

export type PersistedWorkspaceScreen = 'home' | 'settings' | 'prompt-folders'

export type WorkspacePromptFolderPromptTreeEntry = {
  promptFolderId: string
  promptTreeEntryId: string
  promptTreeIsExpanded: boolean
  folderDescriptionEditorViewStateJson: string | null
}

export type WorkspacePersistence = {
  workspaceId: string
  selectedScreen: PersistedWorkspaceScreen
  selectedPromptFolderId: string | null
  promptFolderPromptTreeEntries: WorkspacePromptFolderPromptTreeEntry[]
}

export const createDefaultWorkspacePersistence = (workspaceId: string): WorkspacePersistence => {
  return {
    workspaceId,
    selectedScreen: 'home',
    selectedPromptFolderId: null,
    promptFolderPromptTreeEntries: []
  }
}

export const cloneWorkspacePromptFolderPromptTreeEntries = (
  entries: WorkspacePromptFolderPromptTreeEntry[]
): WorkspacePromptFolderPromptTreeEntry[] => {
  return entries.map((entry) => ({
    promptFolderId: entry.promptFolderId,
    promptTreeEntryId: entry.promptTreeEntryId,
    promptTreeIsExpanded: entry.promptTreeIsExpanded,
    folderDescriptionEditorViewStateJson: entry.folderDescriptionEditorViewStateJson
  }))
}

export const toSerializableWorkspacePersistence = (
  workspacePersistence: WorkspacePersistence
): WorkspacePersistence => {
  const selectedScreen = workspacePersistence.selectedScreen

  return {
    workspaceId: workspacePersistence.workspaceId,
    selectedScreen,
    selectedPromptFolderId:
      selectedScreen === 'prompt-folders' ? workspacePersistence.selectedPromptFolderId : null,
    promptFolderPromptTreeEntries: cloneWorkspacePromptFolderPromptTreeEntries(
      workspacePersistence.promptFolderPromptTreeEntries
    )
  }
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

  const lastWorkspacePath = value.lastWorkspacePath
  if (lastWorkspacePath !== null && typeof lastWorkspacePath !== 'string') {
    return null
  }

  const appSidebarWidthPx =
    typeof value.appSidebarWidthPx === 'number'
      ? Math.round(value.appSidebarWidthPx)
      : DEFAULT_USER_PERSISTENCE.appSidebarWidthPx

  return {
    lastWorkspacePath,
    appSidebarWidthPx
  }
}

const parsePersistedWorkspaceScreen = (value: unknown): PersistedWorkspaceScreen => {
  if (value === 'home' || value === 'settings' || value === 'prompt-folders') {
    return value
  }

  return 'home'
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

  const folderDescriptionEditorViewStateJson = value.folderDescriptionEditorViewStateJson
  if (
    folderDescriptionEditorViewStateJson !== undefined &&
    folderDescriptionEditorViewStateJson !== null &&
    typeof folderDescriptionEditorViewStateJson !== 'string'
  ) {
    return null
  }

  const promptTreeIsExpanded =
    value.promptTreeIsExpanded === undefined
      ? true
      : typeof value.promptTreeIsExpanded === 'boolean'
        ? value.promptTreeIsExpanded
        : null
  if (promptTreeIsExpanded === null) {
    return null
  }

  return {
    promptFolderId: value.promptFolderId,
    promptTreeEntryId: value.promptTreeEntryId,
    promptTreeIsExpanded,
    folderDescriptionEditorViewStateJson: folderDescriptionEditorViewStateJson ?? null
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

  const selectedScreen = parsePersistedWorkspaceScreen(value.selectedScreen)
  const selectedPromptFolderId =
    value.selectedPromptFolderId === null || typeof value.selectedPromptFolderId === 'string'
      ? value.selectedPromptFolderId
      : null
  const promptFolderPromptTreeEntries = parseWorkspacePromptFolderPromptTreeEntries(
    value.promptFolderPromptTreeEntries
  )

  return {
    workspaceId,
    selectedScreen,
    selectedPromptFolderId: selectedScreen === 'prompt-folders' ? selectedPromptFolderId : null,
    promptFolderPromptTreeEntries
  }
}
