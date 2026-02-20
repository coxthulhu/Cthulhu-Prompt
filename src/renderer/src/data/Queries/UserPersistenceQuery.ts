import {
  LOAD_USER_PERSISTENCE_CHANNEL,
  LOAD_WORKSPACE_PERSISTENCE_CHANNEL
} from '@shared/UserPersistence'
import type {
  LoadUserPersistenceResult,
  LoadWorkspacePersistenceRequest,
  LoadWorkspacePersistenceResult,
  UserPersistence,
  WorkspacePersistence
} from '@shared/UserPersistence'
import { runLoad } from '../IpcFramework/Load'
import { ipcInvoke, ipcInvokeWithPayload } from '../IpcFramework/IpcRequestInvoke'

export const loadUserPersistence = async (): Promise<UserPersistence> => {
  const result = await runLoad(() =>
    ipcInvoke<LoadUserPersistenceResult>(LOAD_USER_PERSISTENCE_CHANNEL)
  )
  return result.userPersistence
}

export const loadWorkspacePersistence = async (
  workspaceId: string
): Promise<WorkspacePersistence> => {
  const result = await runLoad(() =>
    ipcInvokeWithPayload<LoadWorkspacePersistenceResult, LoadWorkspacePersistenceRequest>(
      LOAD_WORKSPACE_PERSISTENCE_CHANNEL,
      { workspaceId }
    )
  )

  return result.workspacePersistence
}
