import type { Workspace } from '@shared/Workspace'
import type { PersistenceLayer } from './PersistenceTypes'

export type WorkspacePersistenceFields = {
  workspacePath: string
}

export const workspacePersistence: PersistenceLayer<Workspace, WorkspacePersistenceFields> = {
  persistData: async (_persistenceFields, _data) => {
    // TODO: Persist workspace data.
  },
  loadData: async (_persistenceFields) => {
    // TODO: Load workspace data.
    return null
  },
  removeData: async (_persistenceFields) => {
    // TODO: Remove workspace data.
  }
}
