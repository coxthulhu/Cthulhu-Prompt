import type { Workspace } from '@shared/Workspace'
import { createCommittedStore } from './CommittedStore'
import type { RevisionData } from './Data'
import {
  workspacePersistence,
  type WorkspacePersistenceFields
} from '../Persistence/WorkspacePersistence'
import { createRevisionDataHandlers } from './RevisionDataHandlers'

const committedStore = createCommittedStore<Workspace, WorkspacePersistenceFields>()

const emitCommittedRevisionChanged = (_id: string): void => {
  // TODO: Emit committed workspace update events.
}

const { loadDataFromPersistence, changeDataAndPersist } = createRevisionDataHandlers({
  committedStore,
  persistence: workspacePersistence,
  emitCommittedRevisionChanged
})

export const workspaceData: RevisionData<Workspace, WorkspacePersistenceFields> = {
  committedStore,
  changeDataAndPersist,
  loadDataFromPersistence,
  emitCommittedRevisionChanged
}
