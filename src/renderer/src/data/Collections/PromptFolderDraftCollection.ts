import { createCollection, localOnlyCollectionOptions } from '@tanstack/svelte-db'
import type { PromptFolderSettingsUpdate } from '@shared/PromptFolder'

export type PromptFolderDraftRecord = PromptFolderSettingsUpdate & {
  id: string
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
