import { createCollection, localOnlyCollectionOptions } from '@tanstack/svelte-db'
import type {
  WorkspaceScreenSelection,
  WorkspacePromptFolderPromptTreeEntry
} from '@shared/UserPersistence'

export type WorkspacePersistenceDraftRecord = WorkspaceScreenSelection & {
  id: string
  lastPromptFolderId: string | null
  promptFolderPromptTreeEntries: WorkspacePromptFolderPromptTreeEntry[]
}

// Local-only draft state for workspace screen selection before sync writes.
export const workspacePersistenceDraftCollection = createCollection(
  localOnlyCollectionOptions<WorkspacePersistenceDraftRecord>({
    id: 'workspace-persistence-drafts',
    getKey: (draft) => draft.id
  })
)
