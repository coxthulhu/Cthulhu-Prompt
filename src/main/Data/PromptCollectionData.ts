import { promptCollectionPersistence } from '../Persistence/PromptCollectionPersistence'
import { createRevisionData } from './RevisionDataFactory'

const emitCommittedRevisionChanged = (_id: string): void => {
  // TODO: Emit committed prompt collection update events.
}

export const promptCollectionData = createRevisionData({
  persistence: promptCollectionPersistence,
  emitCommittedRevisionChanged
})
