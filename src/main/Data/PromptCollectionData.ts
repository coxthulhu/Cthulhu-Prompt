import { contentPersistence } from '../Persistence/sqlite/WorkspaceDatabase'
import { createRevisionData } from './RevisionDataFactory'

const emitCommittedRevisionChanged = (_id: string): void => {
  // TODO: Emit committed prompt collection update events.
}

export const promptCollectionData = createRevisionData({
  persistence: contentPersistence('promptCollection'),
  emitCommittedRevisionChanged
})
