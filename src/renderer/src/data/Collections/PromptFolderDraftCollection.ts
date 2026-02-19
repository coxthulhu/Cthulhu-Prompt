import { createCollection, localOnlyCollectionOptions } from '@tanstack/svelte-db'

export type PromptFolderDraftRecord = {
  id: string
  folderDescription: string
  // Tracks whether this folder has completed at least one initial screen load this session.
  hasLoadedInitialData: boolean
}

// Local-only UI draft state for prompt folder description editing.
export const promptFolderDraftCollection = createCollection(
  localOnlyCollectionOptions<PromptFolderDraftRecord>({
    id: 'prompt-folder-drafts',
    getKey: (draft) => draft.id
  })
)
