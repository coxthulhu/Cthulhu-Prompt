import { promptPersistence } from '../Persistence/PromptPersistence'
import { createRevisionData } from './RevisionDataFactory'

const emitCommittedRevisionChanged = (_id: string): void => {
  // TODO: Emit committed prompt update events.
}

export const promptData = createRevisionData({
  persistence: promptPersistence,
  emitCommittedRevisionChanged
})
