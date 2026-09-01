import {
  LOAD_USER_PERSISTENCE_CHANNEL
} from '@shared/UserPersistence'
import type { LoadUserPersistenceResult } from '@shared/UserPersistence'
import { userPersistenceCollection } from '../Collections/UserPersistenceCollection'
import { runLoad } from '../IpcFramework/Load'
import { ipcInvoke } from '../IpcFramework/IpcRequestInvoke'

export const loadUserPersistence = async (): Promise<void> => {
  const result = await runLoad(() =>
    ipcInvoke<LoadUserPersistenceResult>(LOAD_USER_PERSISTENCE_CHANNEL)
  )

  userPersistenceCollection.utils.upsertAuthoritative(result.userPersistence)
}
