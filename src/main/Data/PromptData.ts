import { contentPersistence } from '../Persistence/sqlite/WorkspaceDatabase'
import { createRevisionData } from './RevisionDataFactory'

const emitCommittedRevisionChanged = (_id: string): void => {
  // TODO: Emit committed prompt update events.
}

export const promptData = createRevisionData({
  persistence: contentPersistence('prompt'),
  emitCommittedRevisionChanged
})
