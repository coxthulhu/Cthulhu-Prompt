import type { IpcResult } from './IpcResult'
import type { RevisionEnvelope, RevisionPayloadEntity } from './Revision'

export type UserPersistence = {
  lastWorkspacePath: string | null
  appSidebarWidthPx: number
  promptOutlinerWidthPx: number
}

export const DEFAULT_USER_PERSISTENCE: UserPersistence = {
  lastWorkspacePath: null,
  appSidebarWidthPx: 200,
  promptOutlinerWidthPx: 200
}

export const USER_PERSISTENCE_ID = 'user-persistence'

export type WorkspacePersistence = {
  schemaVersion: 1
}

export const DEFAULT_WORKSPACE_PERSISTENCE: WorkspacePersistence = {
  schemaVersion: 1
}

export const LOAD_USER_PERSISTENCE_CHANNEL = 'load-user-persistence'
export const LOAD_WORKSPACE_PERSISTENCE_CHANNEL = 'load-workspace-persistence'
export const UPDATE_USER_PERSISTENCE_CHANNEL = 'update-user-persistence'

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

export type LoadWorkspacePersistenceResult = IpcResult<{
  workspacePersistence: WorkspacePersistence
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
  const promptOutlinerWidthPx =
    typeof value.promptOutlinerWidthPx === 'number'
      ? Math.round(value.promptOutlinerWidthPx)
      : DEFAULT_USER_PERSISTENCE.promptOutlinerWidthPx

  return {
    lastWorkspacePath,
    appSidebarWidthPx,
    promptOutlinerWidthPx
  }
}

export const parseWorkspacePersistence = (value: unknown): WorkspacePersistence | null => {
  if (!isRecord(value)) {
    return null
  }

  if (value.schemaVersion === 1) {
    return { schemaVersion: 1 }
  }

  return null
}
