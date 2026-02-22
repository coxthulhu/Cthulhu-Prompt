import type { UserPersistence } from '@shared/UserPersistence'
import {
  USER_PERSISTENCE_DRAFT_ID,
  userPersistenceDraftCollection
} from '../Collections/UserPersistenceDraftCollection'

export const upsertUserPersistenceDraft = (userPersistence: UserPersistence): void => {
  const existingRecord = userPersistenceDraftCollection.get(USER_PERSISTENCE_DRAFT_ID)

  if (!existingRecord) {
    userPersistenceDraftCollection.insert({
      id: USER_PERSISTENCE_DRAFT_ID,
      lastWorkspacePath: userPersistence.lastWorkspacePath
    })
    return
  }

  userPersistenceDraftCollection.update(USER_PERSISTENCE_DRAFT_ID, (draftRecord) => {
    draftRecord.lastWorkspacePath = userPersistence.lastWorkspacePath
  })
}
