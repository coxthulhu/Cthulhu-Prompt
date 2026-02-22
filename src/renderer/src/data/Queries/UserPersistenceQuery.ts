import {
  LOAD_USER_PERSISTENCE_CHANNEL,
  LOAD_WORKSPACE_PERSISTENCE_CHANNEL
} from '@shared/UserPersistence'
import type {
  LoadUserPersistenceResult,
  LoadWorkspacePersistenceRequest,
  LoadWorkspacePersistenceResult,
  WorkspacePersistence
} from '@shared/UserPersistence'
import { userPersistenceCollection } from '../Collections/UserPersistenceCollection'
import { runLoad } from '../IpcFramework/Load'
import { ipcInvoke, ipcInvokeWithPayload } from '../IpcFramework/IpcRequestInvoke'
import { upsertUserPersistenceDraft } from '../UiState/UserPersistenceDraftMutations.svelte.ts'

export const loadUserPersistence = async (): Promise<void> => {
  const result = await runLoad(() =>
    ipcInvoke<LoadUserPersistenceResult>(LOAD_USER_PERSISTENCE_CHANNEL)
  )

  userPersistenceCollection.utils.upsertAuthoritative(result.userPersistence)
  upsertUserPersistenceDraft(result.userPersistence.data)
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
