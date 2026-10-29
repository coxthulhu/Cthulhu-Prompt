import { AUTOSAVE_MS } from '@renderer/data/UiState/autosave/draftAutosave'
import { USER_PERSISTENCE_ID } from '@shared/domain/user-persistence/UserPersistence'
import { userPersistenceCollection } from '@renderer/data/Collections/UserPersistenceCollection'
import { submitPacedUpdateTransactionAndWait } from '@renderer/data/IpcFramework/RevisionCollections'
import { mutatePacedUserPersistenceAutosaveUpdate } from '@renderer/data/Mutations/UserPersistenceMutations'

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

/** Saves which settings sidebar sections are collapsed on this machine. */
export const setSettingsCollapsedSectionIdsWithAutosave = (sectionIds: string[]): void => {
  /** Latest optimistic preferences, including other pending autosave edits. */
  const userPersistence = userPersistenceCollection.get(USER_PERSISTENCE_ID)!
  mutatePacedUserPersistenceAutosaveUpdate({
    userPersistence: { ...userPersistence, settingsCollapsedSectionIds: sectionIds },
    debounceMs: AUTOSAVE_MS
  })
}

/** Saves the settings screen scroll offset on this machine. */
export const setSettingsScrollTopWithAutosave = (scrollTopPx: number): void => {
  /** Rounded offset compared against the latest optimistic value to skip unchanged writes. */
  const roundedScrollTopPx = Math.round(scrollTopPx)
  const userPersistence = userPersistenceCollection.get(USER_PERSISTENCE_ID)!
  if (userPersistence.settingsScrollTopPx === roundedScrollTopPx) return
  mutatePacedUserPersistenceAutosaveUpdate({
    userPersistence: { ...userPersistence, settingsScrollTopPx: roundedScrollTopPx },
    debounceMs: AUTOSAVE_MS
  })
}

export const flushUserPersistenceAutosaves = async (): Promise<void> => {
  await submitPacedUpdateTransactionAndWait(userPersistenceCollection.id, USER_PERSISTENCE_ID)
}
