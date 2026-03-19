import type { Workspace } from '@shared/Workspace'
import {
  workspacePersistence,
  type WorkspacePersistenceFields
} from '../Persistence/WorkspacePersistence'
import { createRevisionData } from './RevisionDataFactory'

const emitCommittedRevisionChanged = (_id: string): void => {
  // TODO: Emit committed workspace update events.
}

export const workspaceData = createRevisionData<Workspace, WorkspacePersistenceFields>({
  persistence: workspacePersistence,
  emitCommittedRevisionChanged
})
