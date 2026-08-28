import { createCollection, localOnlyCollectionOptions } from '@tanstack/svelte-db'

/** Renderer-session client state for one prompt. */
export type PromptClientStateRecord = {
  id: string
  isEdited: boolean
}

/** Latches a prompt's edited marker for the remainder of the renderer session. */
export const markPromptClientStateEdited = (
  clientState: PromptClientStateRecord
): PromptClientStateRecord => {
  clientState.isEdited = true
  return clientState
}

/** Local-only renderer-session state for prompts. */
export const promptClientStateCollection = createCollection(
  localOnlyCollectionOptions<PromptClientStateRecord>({
    id: 'prompt-client-state',
    getKey: (clientState) => clientState.id
  })
)
