import {
  UPDATE_USER_PERSISTENCE_CHANNEL,
  USER_PERSISTENCE_ID,
  type UserPersistence,
  type UserPersistenceRevisionResponsePayload
} from '@shared/UserPersistence'
import type { Transaction } from '@tanstack/svelte-db'
import {
  USER_PERSISTENCE_DRAFT_ID,
  userPersistenceDraftCollection
} from '../Collections/UserPersistenceDraftCollection'
import { userPersistenceCollection } from '../Collections/UserPersistenceCollection'
import { getLatestMutationModifiedRecord } from '../IpcFramework/RevisionMutationLookup'
import { runRevisionMutation } from '../IpcFramework/RevisionCollections'
import { upsertUserPersistenceDraft } from '../UiState/UserPersistenceDraftMutations.svelte.ts'

const readLatestUserPersistenceFromTransaction = (transaction: Transaction<any>): UserPersistence => {
  return getLatestMutationModifiedRecord(
    transaction,
    userPersistenceCollection.id,
    USER_PERSISTENCE_ID,
    () => userPersistenceCollection.get(USER_PERSISTENCE_ID)!
  )
}

export const syncLastWorkspacePath = async (lastWorkspacePath: string | null): Promise<void> => {
  await runRevisionMutation<UserPersistenceRevisionResponsePayload>({
    mutateOptimistically: ({ collections }) => {
      collections.userPersistence.update(USER_PERSISTENCE_ID, (draft) => {
        draft.lastWorkspacePath = lastWorkspacePath
      })
      collections.userPersistenceDraft.update(USER_PERSISTENCE_DRAFT_ID, (draft) => {
        draft.lastWorkspacePath = lastWorkspacePath
      })
    },
    persistMutations: async ({ entities, invoke, transaction }) => {
      const latestUserPersistence = readLatestUserPersistenceFromTransaction(transaction)

      const mutationResult = await invoke(UPDATE_USER_PERSISTENCE_CHANNEL, {
        payload: {
          userPersistence: entities.userPersistence({
            id: USER_PERSISTENCE_ID,
            data: latestUserPersistence
          })
        }
      })

      if (mutationResult.success) {
        userPersistenceDraftCollection.utils.acceptMutations(transaction)
      }

      return mutationResult
    },
    handleSuccessOrConflictResponse: (payload) => {
      userPersistenceCollection.utils.upsertAuthoritative(payload.userPersistence)
      upsertUserPersistenceDraft(payload.userPersistence.data)
    },
    conflictMessage: 'User persistence update conflict'
  })
}
