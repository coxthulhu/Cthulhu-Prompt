import { contentPersistence } from '../Persistence/sqlite/WorkspaceDatabase'
import { createRevisionData } from './RevisionDataFactory'

const emitCommittedRevisionChanged = (_id: string): void => {
  // TODO: Emit committed prompt template update events.
}

export const promptTemplateData = createRevisionData({
  persistence: contentPersistence('promptTemplate'),
  emitCommittedRevisionChanged
})
