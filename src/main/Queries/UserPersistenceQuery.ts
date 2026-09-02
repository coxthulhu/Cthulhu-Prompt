import { ipcMain } from 'electron'
import {
  LOAD_USER_PERSISTENCE_CHANNEL,
  USER_PERSISTENCE_ID
} from '@shared/UserPersistence'
import type { LoadUserPersistenceResult } from '@shared/UserPersistence'
import { data } from '../Data/Data'
import { buildMainAuthoritativeSnapshots } from '../IpcFramework/AuthoritativeSnapshots'

export const setupUserPersistenceQueryHandlers = (): void => {
  ipcMain.handle(LOAD_USER_PERSISTENCE_CHANNEL, async (): Promise<LoadUserPersistenceResult> => {
    try {
      // Side effect: hydrate the domain committed store before renderer mutations become available.
      await data.userPersistence.loadDataFromPersistence(USER_PERSISTENCE_ID, {})
      /** Required singleton committed entry loaded from SQLite. */
      const entry = data.userPersistence.committedStore.getEntry(USER_PERSISTENCE_ID)
      if (!entry) throw new Error('User persistence not loaded')
      return {
        success: true,
        snapshots: buildMainAuthoritativeSnapshots([
          { entityType: 'userPersistence', id: USER_PERSISTENCE_ID }
        ])
      }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) }
    }
  })
}
