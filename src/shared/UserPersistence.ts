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

export const LOAD_USER_PERSISTENCE_CHANNEL = 'load-user-persistence'
export const LOAD_WORKSPACE_PERSISTENCE_CHANNEL = 'load-workspace-persistence'

export type LoadWorkspacePersistenceRequest = {
  workspaceId: string
}

export type LoadUserPersistenceResult = IpcResult<{
  userPersistence: UserPersistence
}>

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
  if (lastWorkspacePath === null || typeof lastWorkspacePath === 'string') {
    return { lastWorkspacePath }
  }

  return null
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
