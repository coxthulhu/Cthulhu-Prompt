import { workspacePersistence } from '../Persistence/WorkspacePersistence'
import { createRevisionData } from './RevisionDataFactory'

const emitCommittedRevisionChanged = (_id: string): void => {
  // TODO: Emit committed workspace update events.
}

export const workspaceData = createRevisionData({
  persistence: workspacePersistence,
  emitCommittedRevisionChanged
})
