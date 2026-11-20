import { workspaceDatabasePersistence } from '../Persistence/sqlite/WorkspaceDatabase'
import { createRevisionData } from './RevisionDataFactory'

const emitCommittedRevisionChanged = (_id: string): void => {
  // TODO: Emit committed workspace update events.
}

export const workspaceData = createRevisionData({
  persistence: workspaceDatabasePersistence,
  emitCommittedRevisionChanged
})
