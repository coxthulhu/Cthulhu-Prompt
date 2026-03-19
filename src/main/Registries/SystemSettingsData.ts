import type { FSWatcher } from 'chokidar'
import { produce } from 'immer'
import type { SystemSettings } from '@shared/SystemSettings'
import { createCommittedStore } from './CommittedStore'
import type { DataRecipe, RevisionData } from './Data'

const committedStore = createCommittedStore<SystemSettings, never>()

const emitCommittedRevisionChanged = (_id: string): void => {
  // TODO: Emit committed system settings update events.
}

const handleFilesystemChange = (_changedPath: string): void => {
  // TODO: Handle system settings filesystem changes.
}

const addWatchers = (_watcher: FSWatcher): void => {
  // TODO: Register system settings watchers.
}

const changeDataAndPersist = async (
  id: string,
  recipe: DataRecipe<SystemSettings>
): Promise<number | null> => {
  const committed = committedStore.getCommitted(id)

  if (!committed) {
    return null
  }

  const nextData = produce(committed, recipe)

  // TODO: Persist system settings to disk.
  const nextRevision = committedStore.commitAfterWrite(id, nextData)
  emitCommittedRevisionChanged(id)

  return nextRevision
}

export const systemSettingsData: RevisionData<SystemSettings, never> = {
  committedStore,
  changeDataAndPersist,
  emitCommittedRevisionChanged,
  handleFilesystemChange,
  addWatchers
}
