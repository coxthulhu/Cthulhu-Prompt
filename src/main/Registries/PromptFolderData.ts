import type { FSWatcher } from 'chokidar'
import { produce } from 'immer'
import type { PromptFolder } from '@shared/PromptFolder'
import { createCommittedStore } from './CommittedStore'
import type { DataRecipe, RevisionData } from './Data'

export type PromptFolderFileFields = {
  workspaceId: string
  workspacePath: string
  folderName: string
}

const committedStore = createCommittedStore<PromptFolder, PromptFolderFileFields>()

const emitCommittedRevisionChanged = (_id: string): void => {
  // TODO: Emit committed prompt folder update events.
}

const handleFilesystemChange = (_changedPath: string): void => {
  // TODO: Handle prompt folder filesystem changes.
}

const addWatchers = (_watcher: FSWatcher): void => {
  // TODO: Register prompt folder watchers.
}

const changeDataAndPersist = async (
  id: string,
  recipe: DataRecipe<PromptFolder>
): Promise<number | null> => {
  const committed = committedStore.getCommitted(id)

  if (!committed) {
    return null
  }

  const nextData = produce(committed, recipe)

  // TODO: Persist prompt folder data to disk.
  const nextRevision = committedStore.commitAfterWrite(id, nextData)
  emitCommittedRevisionChanged(id)

  return nextRevision
}

export const promptFolderData: RevisionData<PromptFolder, PromptFolderFileFields> = {
  committedStore,
  changeDataAndPersist,
  emitCommittedRevisionChanged,
  handleFilesystemChange,
  addWatchers
}
