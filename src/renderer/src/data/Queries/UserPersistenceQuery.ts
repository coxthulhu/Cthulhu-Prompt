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
    ipcInvoke<LoadUserPersistenceResult>('load-user-persistence')
  )
  return result.userPersistence
}

export const loadWorkspacePersistence = async (
  workspaceId: string
): Promise<WorkspacePersistence> => {
  const result = await runLoad(() =>
    ipcInvokeWithPayload<LoadWorkspacePersistenceResult, LoadWorkspacePersistenceRequest>(
      'load-workspace-persistence',
      { workspaceId }
    )
  )

  return result.workspacePersistence
}
