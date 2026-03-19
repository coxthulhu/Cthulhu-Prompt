import type { PromptPersisted } from '@shared/Prompt'
import { createCommittedStore } from './CommittedStore'
import type { RevisionData } from './Data'
import {
  promptPersistence,
  type PromptPersistenceFields
} from '../Persistence/PromptPersistence'
import { createRevisionDataHandlers } from './RevisionDataHandlers'

const committedStore = createCommittedStore<PromptPersisted, PromptPersistenceFields>()

const emitCommittedRevisionChanged = (_id: string): void => {
  // TODO: Emit committed prompt update events.
}

const { loadDataFromPersistence, changeDataAndPersist } = createRevisionDataHandlers({
  committedStore,
  persistence: promptPersistence,
  emitCommittedRevisionChanged
})

export const promptData: RevisionData<PromptPersisted, PromptPersistenceFields> = {
  committedStore,
  changeDataAndPersist,
  loadDataFromPersistence,
  emitCommittedRevisionChanged
}
