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
  persistData: async (_persistenceFields, _data) => {
    // TODO: Persist prompt folder data.
  },
  loadData: async (_persistenceFields) => {
    // TODO: Load prompt folder data.
    return null
  },
  removeData: async (_persistenceFields) => {
    // TODO: Remove prompt folder data.
  }
}
