import type { PromptFolder } from '@shared/PromptFolder'
import { createCommittedStore } from './CommittedStore'
import type { RevisionData } from './Data'
import {
  promptFolderPersistence,
  type PromptFolderPersistenceFields
} from '../Persistence/PromptFolderPersistence'
import { createRevisionDataHandlers } from './RevisionDataHandlers'

const committedStore = createCommittedStore<PromptFolder, PromptFolderPersistenceFields>()

const emitCommittedRevisionChanged = (_id: string): void => {
  // TODO: Emit committed prompt folder update events.
}

const { loadDataFromPersistence, changeDataAndPersist } = createRevisionDataHandlers({
  committedStore,
  persistence: promptFolderPersistence,
  emitCommittedRevisionChanged
})

export const promptFolderData: RevisionData<PromptFolder, PromptFolderPersistenceFields> = {
  committedStore,
  changeDataAndPersist,
  loadDataFromPersistence,
  emitCommittedRevisionChanged
}
