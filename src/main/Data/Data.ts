import type { Draft } from 'immer'
import type { PersistenceLayer } from '../Persistence/PersistenceTypes'
import type { CommittedStore } from './CommittedStore'
import { promptData } from './PromptData'
import { promptFolderData } from './PromptFolderData'
import { systemSettingsData } from './SystemSettingsData'
import { workspaceData } from './WorkspaceData'

export type DataRecipe<TData> = (draft: Draft<TData>) => void

export type RevisionData<TData, TPersistenceFields, TStagedChange = unknown> = {
  committedStore: CommittedStore<TData, TPersistenceFields>
  persistence: PersistenceLayer<TData, TPersistenceFields, TStagedChange>
  loadDataFromPersistence: (id: string, persistenceFields: TPersistenceFields) => Promise<void>
  emitCommittedRevisionChanged: (id: string) => void
}

export const data = {
  systemSettings: systemSettingsData,
  workspace: workspaceData,
  promptFolder: promptFolderData,
  prompt: promptData
}
