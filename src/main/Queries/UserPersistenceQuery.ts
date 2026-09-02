import {
  LOAD_USER_PERSISTENCE_CHANNEL,
  USER_PERSISTENCE_ID
} from '@shared/UserPersistence'
import { data } from '../Data/Data'
import { handleMainAuthoritativeQuery } from '../IpcFramework/AuthoritativeQuery'

export const setupUserPersistenceQueryHandlers = (): void => {
  handleMainAuthoritativeQuery({
    channel: LOAD_USER_PERSISTENCE_CHANNEL,
    /** Loads the singleton from SQLite before selecting its authoritative snapshot target. */
    query: async () => {
      // Side effect: hydrate the domain committed store before renderer mutations become available.
      await data.userPersistence.loadDataFromPersistence(USER_PERSISTENCE_ID, {})
      /** Required singleton committed entry loaded from SQLite. */
      const entry = data.userPersistence.committedStore.getEntry(USER_PERSISTENCE_ID)
      if (!entry) throw new Error('User persistence not loaded')
      return [{ entityType: 'userPersistence', id: USER_PERSISTENCE_ID }]
    }
  })
}
