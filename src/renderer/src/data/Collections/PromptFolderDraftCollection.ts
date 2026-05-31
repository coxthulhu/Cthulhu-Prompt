import { createCollection, localOnlyCollectionOptions } from '@tanstack/svelte-db'
import type { PromptFolderSettings } from '@shared/PromptFolder'

export type PromptFolderDraftRecord = {
  id: string
  settings: PromptFolderSettings
  // Tracks whether this folder has completed at least one initial screen load this session.
  hasLoadedInitialData: boolean
}

// Local-only UI draft state for prompt folder settings editing.
export const promptFolderDraftCollection = createCollection(
  localOnlyCollectionOptions<PromptFolderDraftRecord>({
    id: 'prompt-folder-drafts',
    getKey: (draft) => draft.id
  })
)
