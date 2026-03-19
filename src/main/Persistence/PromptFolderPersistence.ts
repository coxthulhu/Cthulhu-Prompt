import type { PromptFolder } from '@shared/PromptFolder'
import type { PersistenceLayer } from './PersistenceTypes'

export type PromptFolderPersistenceFields = {
  workspaceId: string
  workspacePath: string
  folderName: string
}

export const promptFolderPersistence: PersistenceLayer<
  PromptFolder,
  PromptFolderPersistenceFields
> = {
  stageChanges: async (_change) => {
    // TODO: Stage prompt folder persistence changes.
    return {}
  },
  commitChanges: async (_stagedChange) => {
    // TODO: Commit staged prompt folder persistence changes.
  },
  revertChanges: async (_stagedChange) => {
    // TODO: Revert staged prompt folder persistence changes.
  },
  loadData: async (_persistenceFields) => {
    // TODO: Load prompt folder data.
    return null
  }
}
