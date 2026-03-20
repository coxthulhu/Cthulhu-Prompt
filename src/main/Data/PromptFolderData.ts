import { promptFolderPersistence } from '../Persistence/PromptFolderPersistence'
import { createRevisionData } from './RevisionDataFactory'

const emitCommittedRevisionChanged = (_id: string): void => {
  // TODO: Emit committed prompt folder update events.
}

export const promptFolderData = createRevisionData({
  persistence: promptFolderPersistence,
  emitCommittedRevisionChanged
})
