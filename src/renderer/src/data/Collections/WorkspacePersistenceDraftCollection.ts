import { createCollection, localOnlyCollectionOptions } from '@tanstack/svelte-db'
import type { PersistedWorkspaceScreen } from '@shared/UserPersistence'

export type WorkspacePersistenceDraftRecord = {
  id: string
  selectedScreen: PersistedWorkspaceScreen
  selectedPromptFolderId: string | null
}

// Local-only draft state for workspace screen selection before sync writes.
export const workspacePersistenceDraftCollection = createCollection(
  localOnlyCollectionOptions<WorkspacePersistenceDraftRecord>({
    id: 'workspace-persistence-drafts',
    getKey: (draft) => draft.id
  })
)
