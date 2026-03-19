import type { Draft } from 'immer'
import type { CommittedStore } from './CommittedStore'
import { promptData } from './PromptData'
import { promptFolderData } from './PromptFolderData'
import { systemSettingsData } from './SystemSettingsData'
import { workspaceData } from './WorkspaceData'

export type DataRecipe<TData> = (draft: Draft<TData>) => void

export type RevisionData<TData, TPersistenceFields> = {
  committedStore: CommittedStore<TData, TPersistenceFields>
  changeDataAndPersist: (id: string, recipe: DataRecipe<TData>) => Promise<number | null>
  loadDataFromPersistence: (id: string, persistenceFields: TPersistenceFields) => Promise<void>
  emitCommittedRevisionChanged: (id: string) => void
}

export const data = {
  systemSettings: systemSettingsData,
  workspace: workspaceData,
  promptFolder: promptFolderData,
  prompt: promptData
}
