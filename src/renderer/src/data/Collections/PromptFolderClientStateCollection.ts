import { createCollection, localOnlyCollectionOptions } from '@tanstack/svelte-db'

/** Renderer-session client state for one prompt folder. */
export type PromptFolderClientStateRecord = {
  id: string
  hasLoadedInitialData: boolean
}

/** Local-only renderer-session state for prompt folders. */
export const promptFolderClientStateCollection = createCollection(
  localOnlyCollectionOptions<PromptFolderClientStateRecord>({
    id: 'prompt-folder-client-state',
    getKey: (clientState) => clientState.id
  })
)
