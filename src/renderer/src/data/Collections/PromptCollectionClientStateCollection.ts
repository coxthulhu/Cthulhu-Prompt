import { createCollection, localOnlyCollectionOptions } from '@tanstack/svelte-db'

/** Renderer-session client state for one prompt collection. */
export type PromptCollectionClientStateRecord = {
  id: string
  hasLoadedInitialData: boolean
}

/** Local-only renderer-session state for prompt collections. */
export const promptCollectionClientStateCollection = createCollection(
  localOnlyCollectionOptions<PromptCollectionClientStateRecord>({
    id: 'prompt-collection-client-state',
    getKey: (clientState) => clientState.id
  })
)
