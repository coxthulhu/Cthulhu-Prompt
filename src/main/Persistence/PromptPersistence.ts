import type { PromptPersisted } from '@shared/Prompt'
import type { PersistenceLayer } from './PersistenceTypes'

export type PromptPersistenceFields = {
  workspaceId: string
  workspacePath: string
  folderName: string
  promptFolderId: string
}

export const promptPersistence: PersistenceLayer<PromptPersisted, PromptPersistenceFields> = {
  persistData: async (_persistenceFields, _data) => {
    // TODO: Persist prompt data.
  },
  loadData: async (_persistenceFields) => {
    // TODO: Load prompt data.
    return null
  },
  removeData: async (_persistenceFields) => {
    // TODO: Remove prompt data.
  }
}
