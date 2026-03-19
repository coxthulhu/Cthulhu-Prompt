import { produce } from 'immer'
import type { PromptPersisted } from '@shared/Prompt'
import { createCommittedStore } from './CommittedStore'
import type { DataRecipe, RevisionData } from './Data'
import {
  promptPersistence,
  type PromptPersistenceFields
} from '../Persistence/PromptPersistence'

const committedStore = createCommittedStore<PromptPersisted, PromptPersistenceFields>()

const emitCommittedRevisionChanged = (_id: string): void => {
  // TODO: Emit committed prompt update events.
}

const loadDataFromPersistence = async (
  id: string,
  persistenceFields: PromptPersistenceFields
): Promise<void> => {
  const loadedData = await promptPersistence.loadData(persistenceFields)

  if (!loadedData) {
    return
  }

  committedStore.setFromDisk(id, loadedData, persistenceFields)
}

const changeDataAndPersist = async (
  id: string,
  recipe: DataRecipe<PromptPersisted>
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

  await promptPersistence.persistData(persistenceFields, nextData)
  const nextRevision = committedStore.commitAfterWrite(id, nextData)
  emitCommittedRevisionChanged(id)

  return nextRevision
}

export const promptData: RevisionData<PromptPersisted, PromptPersistenceFields> = {
  committedStore,
  changeDataAndPersist,
  loadDataFromPersistence,
  emitCommittedRevisionChanged
}
