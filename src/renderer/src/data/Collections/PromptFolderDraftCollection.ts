import { createCollection, localOnlyCollectionOptions } from '@tanstack/svelte-db'

/** Renderer-session load state for one prompt folder. */
export type PromptFolderDraftRecord = {
  id: string
  hasLoadedInitialData: boolean
}

// Local-only prompt-folder state used to avoid unnecessary initial screen loads.
export const promptFolderDraftCollection = createCollection(
  localOnlyCollectionOptions<PromptFolderDraftRecord>({
    id: 'prompt-folder-drafts',
    getKey: (draft) => draft.id
  })
)
