import type { PromptPersisted } from '@shared/Prompt'
import type { PersistenceLayer } from './PersistenceTypes'

export type PromptPersistenceFields = {
  workspaceId: string
  workspacePath: string
  folderName: string
  promptFolderId: string
}

export const promptPersistence: PersistenceLayer<PromptPersisted, PromptPersistenceFields> = {
  stageChanges: async (_change) => {
    // TODO: Stage prompt persistence changes.
    return {}
  },
  commitChanges: async (_stagedChange) => {
    // TODO: Commit staged prompt persistence changes.
  },
  revertChanges: async (_stagedChange) => {
    // TODO: Revert staged prompt persistence changes.
  },
  loadData: async (_persistenceFields) => {
    // TODO: Load prompt data.
    return null
  }
}
