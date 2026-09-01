import {
  UPDATE_USER_PERSISTENCE_CHANNEL,
  type UserPersistence
} from '@shared/UserPersistence'
import {
  parseSetUserPersistenceDomainCommand,
  planSetUserPersistenceDomainMutation
} from '@shared/UserPersistenceDomainMutations'
import { handleMainDomainMutation } from './DomainMutation'

/** Registers the user-persistence singleton domain mutation. */
export const setupUserPersistenceMutationHandlers = (): void => {
  handleMainDomainMutation<UserPersistence>({
    ipc: { channel: UPDATE_USER_PERSISTENCE_CHANNEL },
    mutation: {
      parseCommand: parseSetUserPersistenceDomainCommand,
      plan: planSetUserPersistenceDomainMutation
    }
  })
}
