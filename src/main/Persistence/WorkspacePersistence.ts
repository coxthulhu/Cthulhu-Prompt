import type { Workspace } from '@shared/Workspace'
import type { PersistenceLayer } from './PersistenceTypes'

export type WorkspacePersistenceFields = {
  workspacePath: string
}

export const workspacePersistence: PersistenceLayer<Workspace, WorkspacePersistenceFields> = {
  stageChanges: async (_change) => {
    // TODO: Stage workspace persistence changes.
    return {}
  },
  commitChanges: async (_stagedChange) => {
    // TODO: Commit staged workspace persistence changes.
  },
  revertChanges: async (_stagedChange) => {
    // TODO: Revert staged workspace persistence changes.
  },
  loadData: async (_persistenceFields) => {
    // TODO: Load workspace data.
    return null
  }
}
