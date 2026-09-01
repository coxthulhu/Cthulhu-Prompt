import { AUTOSAVE_MS } from '@renderer/data/draftAutosave'
import { USER_PERSISTENCE_ID } from '@shared/UserPersistence'
import { userPersistenceCollection } from '../Collections/UserPersistenceCollection'
import { submitPacedUpdateTransactionAndWait } from '../IpcFramework/RevisionCollections'
import { mutatePacedUserPersistenceAutosaveUpdate } from '../Mutations/UserPersistenceMutations'

const mutateAppSidebarWidthWithAutosave = (appSidebarWidthPx: number): void => {
  const roundedWidthPx = Math.round(appSidebarWidthPx)
  /** Current user persistence used to skip an unchanged sidebar-width write. */
  const userPersistence = userPersistenceCollection.get(USER_PERSISTENCE_ID)

  if (!userPersistence || userPersistence.appSidebarWidthPx === roundedWidthPx) {
    return
  }

  mutatePacedUserPersistenceAutosaveUpdate({
    userPersistence: { ...userPersistence, appSidebarWidthPx: roundedWidthPx },
    debounceMs: AUTOSAVE_MS,
  })
}

export const setAppSidebarWidthWithAutosave = (appSidebarWidthPx: number): void => {
  mutateAppSidebarWidthWithAutosave(appSidebarWidthPx)
}

export const flushUserPersistenceAutosaves = async (): Promise<void> => {
  await submitPacedUpdateTransactionAndWait(userPersistenceCollection.id, USER_PERSISTENCE_ID)
}
