import {
  LOAD_USER_PERSISTENCE_CHANNEL
} from '@shared/UserPersistence'
import type { LoadUserPersistenceResult } from '@shared/UserPersistence'
import { runLoad } from '../IpcFramework/Load'
import { ipcInvoke } from '../IpcFramework/IpcRequestInvoke'
import { reconcileRendererAuthoritativeSnapshots } from '../IpcFramework/AuthoritativeSnapshots'

export const loadUserPersistence = async (): Promise<void> => {
  const result = await runLoad(() =>
    ipcInvoke<LoadUserPersistenceResult>(LOAD_USER_PERSISTENCE_CHANNEL)
  )

  reconcileRendererAuthoritativeSnapshots(result.snapshots)
}
