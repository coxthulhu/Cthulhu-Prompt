import { createCollection, localOnlyCollectionOptions } from '@tanstack/svelte-db'

/** Renderer-session client state for one prompt template. */
export type PromptTemplateClientStateRecord = {
  id: string
  isEdited: boolean
}

/** Latches a prompt template's edited marker for the remainder of the renderer session. */
export const markPromptTemplateClientStateEdited = (
  clientState: PromptTemplateClientStateRecord
): PromptTemplateClientStateRecord => {
  clientState.isEdited = true
  return clientState
}

/** Local-only renderer-session state for prompt templates. */
export const promptTemplateClientStateCollection = createCollection(
  localOnlyCollectionOptions<PromptTemplateClientStateRecord>({
    id: 'prompt-template-client-state',
    getKey: (clientState) => clientState.id
  })
)
