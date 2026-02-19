import type { IpcResult } from './IpcResult'

export type UserPersistence = {
  lastWorkspacePath: string | null
}

export const DEFAULT_USER_PERSISTENCE: UserPersistence = {
  lastWorkspacePath: null
}

export type WorkspacePersistence = {
  schemaVersion: 1
}

export const DEFAULT_WORKSPACE_PERSISTENCE: WorkspacePersistence = {
  schemaVersion: 1
}

export type LoadWorkspacePersistenceRequest = {
  workspaceId: string
}

export type LoadUserPersistenceResult = IpcResult<{
  userPersistence: UserPersistence
}>

export type LoadWorkspacePersistenceResult = IpcResult<{
  workspacePersistence: WorkspacePersistence
}>
