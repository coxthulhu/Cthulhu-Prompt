import { createCollection } from '@tanstack/svelte-db'
import { USER_PERSISTENCE_ID, type UserPersistence } from '@shared/domain/user-persistence/UserPersistence'
import { revisionCollectionOptions } from './RevisionCollection'

export const userPersistenceCollection = createCollection(
  revisionCollectionOptions<UserPersistence>({
    id: 'user-persistence',
    getKey: () => USER_PERSISTENCE_ID
  })
)
