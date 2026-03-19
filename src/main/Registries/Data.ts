import type { FSWatcher } from 'chokidar'
import type { Draft } from 'immer'
import type { CommittedStore } from './CommittedStore'
import { promptData } from './PromptData'
import { promptFolderData } from './PromptFolderData'
import { systemSettingsData } from './SystemSettingsData'
import { workspaceData } from './WorkspaceData'

export type DataRecipe<TData> = (draft: Draft<TData>) => void

export type RevisionData<TData, TFileFields> = {
  committedStore: CommittedStore<TData, TFileFields>
  changeDataAndPersist: (id: string, recipe: DataRecipe<TData>) => Promise<number | null>
  emitCommittedRevisionChanged: (id: string) => void
  handleFilesystemChange: (changedPath: string) => void
  addWatchers: (watcher: FSWatcher) => void
}

export const data = {
  systemSettings: systemSettingsData,
  workspace: workspaceData,
  promptFolder: promptFolderData,
  prompt: promptData
}
