import type { FSWatcher } from 'chokidar'
import { produce } from 'immer'
import type { PromptPersisted } from '@shared/Prompt'
import { createCommittedStore } from './CommittedStore'
import type { DataRecipe, RevisionData } from './Data'

export type PromptFileFields = {
  workspaceId: string
  workspacePath: string
  folderName: string
  promptFolderId: string
}

const committedStore = createCommittedStore<PromptPersisted, PromptFileFields>()

const emitCommittedRevisionChanged = (_id: string): void => {
  // TODO: Emit committed prompt update events.
}

const handleFilesystemChange = (_changedPath: string): void => {
  // TODO: Handle prompt filesystem changes.
}

const addWatchers = (_watcher: FSWatcher): void => {
  // TODO: Register prompt watchers.
}

const changeDataAndPersist = async (
  id: string,
  recipe: DataRecipe<PromptPersisted>
): Promise<number | null> => {
  const committed = committedStore.getCommitted(id)

  if (!committed) {
    return null
  }

  const nextData = produce(committed, recipe)

  // TODO: Persist prompt data to disk.
  const nextRevision = committedStore.commitAfterWrite(id, nextData)
  emitCommittedRevisionChanged(id)

  return nextRevision
}

export const promptData: RevisionData<PromptPersisted, PromptFileFields> = {
  committedStore,
  changeDataAndPersist,
  emitCommittedRevisionChanged,
  handleFilesystemChange,
  addWatchers
}
