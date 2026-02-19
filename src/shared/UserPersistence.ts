import type { IpcResult } from './IpcResult'

export type UserPersistence = Record<string, unknown>
export type WorkspacePersistence = Record<string, unknown>

export type LoadWorkspacePersistenceRequest = {
  workspaceId: string
}

export type LoadUserPersistenceResult = IpcResult<{
  userPersistence: UserPersistence
}>

export type LoadWorkspacePersistenceResult = IpcResult<{
  workspacePersistence: WorkspacePersistence
}>
