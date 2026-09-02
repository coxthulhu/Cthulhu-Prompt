import {
  LOAD_USER_PERSISTENCE_CHANNEL
} from '@shared/UserPersistence'
import { runRendererAuthoritativeQuery } from '../IpcFramework/AuthoritativeQuery'

export const loadUserPersistence = async (): Promise<void> => {
  await runRendererAuthoritativeQuery(LOAD_USER_PERSISTENCE_CHANNEL)
}
