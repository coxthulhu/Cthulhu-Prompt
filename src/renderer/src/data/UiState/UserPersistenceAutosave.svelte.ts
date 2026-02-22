import { AUTOSAVE_MS } from '@renderer/data/draftAutosave'
import { USER_PERSISTENCE_ID } from '@shared/UserPersistence'
import {
  USER_PERSISTENCE_DRAFT_ID,
  userPersistenceDraftCollection
} from '../Collections/UserPersistenceDraftCollection'
import { userPersistenceCollection } from '../Collections/UserPersistenceCollection'
import { submitPacedUpdateTransactionAndWait } from '../IpcFramework/RevisionCollections'
import { mutatePacedUserPersistenceAutosaveUpdate } from '../Mutations/UserPersistenceMutations'

const mutateAppSidebarWidthWithAutosave = (appSidebarWidthPx: number): void => {
  const roundedWidthPx = Math.round(appSidebarWidthPx)
  const draftRecord = userPersistenceDraftCollection.get(USER_PERSISTENCE_DRAFT_ID)

  if (!draftRecord || draftRecord.appSidebarWidthPx === roundedWidthPx) {
    return
  }

  mutatePacedUserPersistenceAutosaveUpdate({
    debounceMs: AUTOSAVE_MS,
    mutateOptimistically: ({ collections }) => {
      collections.userPersistence.update(USER_PERSISTENCE_ID, (draft) => {
        draft.appSidebarWidthPx = roundedWidthPx
      })
      collections.userPersistenceDraft.update(USER_PERSISTENCE_DRAFT_ID, (draft) => {
        draft.appSidebarWidthPx = roundedWidthPx
      })
    }
  })
}

const mutatePromptOutlinerWidthWithAutosave = (promptOutlinerWidthPx: number): void => {
  const roundedWidthPx = Math.round(promptOutlinerWidthPx)
  const draftRecord = userPersistenceDraftCollection.get(USER_PERSISTENCE_DRAFT_ID)

  if (!draftRecord || draftRecord.promptOutlinerWidthPx === roundedWidthPx) {
    return
  }

  mutatePacedUserPersistenceAutosaveUpdate({
    debounceMs: AUTOSAVE_MS,
    mutateOptimistically: ({ collections }) => {
      collections.userPersistence.update(USER_PERSISTENCE_ID, (draft) => {
        draft.promptOutlinerWidthPx = roundedWidthPx
      })
      collections.userPersistenceDraft.update(USER_PERSISTENCE_DRAFT_ID, (draft) => {
        draft.promptOutlinerWidthPx = roundedWidthPx
      })
    }
  })
}

export const setAppSidebarWidthWithAutosave = (appSidebarWidthPx: number): void => {
  mutateAppSidebarWidthWithAutosave(appSidebarWidthPx)
}

export const setPromptOutlinerWidthWithAutosave = (promptOutlinerWidthPx: number): void => {
  mutatePromptOutlinerWidthWithAutosave(promptOutlinerWidthPx)
}

export const flushUserPersistenceAutosaves = async (): Promise<void> => {
  await submitPacedUpdateTransactionAndWait(userPersistenceCollection.id, USER_PERSISTENCE_ID)
}
