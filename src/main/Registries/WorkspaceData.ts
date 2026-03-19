import type { FSWatcher } from 'chokidar'
import { produce } from 'immer'
import type { Workspace } from '@shared/Workspace'
import { createCommittedStore } from './CommittedStore'
import type { DataRecipe, RevisionData } from './Data'

export type WorkspaceFileFields = {
  workspacePath: string
}

const committedStore = createCommittedStore<Workspace, WorkspaceFileFields>()

const emitCommittedRevisionChanged = (_id: string): void => {
  // TODO: Emit committed workspace update events.
}

const handleFilesystemChange = (_changedPath: string): void => {
  // TODO: Handle workspace filesystem changes.
}

const addWatchers = (_watcher: FSWatcher): void => {
  // TODO: Register workspace watchers.
}

const changeDataAndPersist = async (
  id: string,
  recipe: DataRecipe<Workspace>
): Promise<number | null> => {
  const committed = committedStore.getCommitted(id)

  if (!committed) {
    return null
  }

  const nextData = produce(committed, recipe)

  // TODO: Persist workspace data to disk.
  const nextRevision = committedStore.commitAfterWrite(id, nextData)
  emitCommittedRevisionChanged(id)

  return nextRevision
}

export const workspaceData: RevisionData<Workspace, WorkspaceFileFields> = {
  committedStore,
  changeDataAndPersist,
  emitCommittedRevisionChanged,
  handleFilesystemChange,
  addWatchers
}
