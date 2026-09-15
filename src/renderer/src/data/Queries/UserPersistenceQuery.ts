import {
  LOAD_USER_PERSISTENCE_CHANNEL
} from '@shared/domain/user-persistence/UserPersistence'
import { runRendererAuthoritativeQuery } from '@renderer/data/IpcFramework/AuthoritativeQuery'

export const loadUserPersistence = async (): Promise<void> => {
  await runRendererAuthoritativeQuery(LOAD_USER_PERSISTENCE_CHANNEL)
}
