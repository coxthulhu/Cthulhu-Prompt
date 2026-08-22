import { createCollection, localOnlyCollectionOptions } from '@tanstack/svelte-db'
import type {
  WorkspaceAccordionViewEntry,
  WorkspaceScreenSelection,
  WorkspacePromptFolderViewEntry
} from '@shared/UserPersistence'

/** Local editable workspace persistence record. */
export type WorkspacePersistenceDraftRecord = WorkspaceScreenSelection & {
  id: string
  lastPromptFolderId: string | null
  promptFolderViewEntries: WorkspacePromptFolderViewEntry[]
  accordionViewEntries: WorkspaceAccordionViewEntry[]
}

// Local-only draft state for workspace screen selection before sync writes.
export const workspacePersistenceDraftCollection = createCollection(
  localOnlyCollectionOptions<WorkspacePersistenceDraftRecord>({
    id: 'workspace-persistence-drafts',
    getKey: (draft) => draft.id
  })
)
