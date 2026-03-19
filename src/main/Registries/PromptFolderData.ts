import { produce } from 'immer'
import type { PromptFolder } from '@shared/PromptFolder'
import { createCommittedStore } from './CommittedStore'
import type { DataRecipe, RevisionData } from './Data'
import {
  promptFolderPersistence,
  type PromptFolderPersistenceFields
} from '../Persistence/PromptFolderPersistence'

const committedStore = createCommittedStore<PromptFolder, PromptFolderPersistenceFields>()

const emitCommittedRevisionChanged = (_id: string): void => {
  // TODO: Emit committed prompt folder update events.
}

const loadDataFromPersistence = async (
  id: string,
  persistenceFields: PromptFolderPersistenceFields
): Promise<void> => {
  const loadedData = await promptFolderPersistence.loadData(persistenceFields)

  if (!loadedData) {
    return
  }

  committedStore.setFromDisk(id, loadedData, persistenceFields)
}

const changeDataAndPersist = async (
  id: string,
  recipe: DataRecipe<PromptFolder>
): Promise<number | null> => {
  const committed = committedStore.getCommitted(id)

  if (!committed) {
    return null
  }

  const nextData = produce(committed, recipe)
  const persistenceFields = committedStore.getPersistenceFields(id)

  if (!persistenceFields) {
    return null
  }

  await promptFolderPersistence.persistData(persistenceFields, nextData)
  const nextRevision = committedStore.commitAfterWrite(id, nextData)
  emitCommittedRevisionChanged(id)

  return nextRevision
}

export const promptFolderData: RevisionData<PromptFolder, PromptFolderPersistenceFields> = {
  committedStore,
  changeDataAndPersist,
  loadDataFromPersistence,
  emitCommittedRevisionChanged
}
