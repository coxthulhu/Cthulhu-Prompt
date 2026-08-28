import { createCollection, localOnlyCollectionOptions } from '@tanstack/svelte-db'

/** Renderer-session edit marker for one prompt template. */
export type PromptTemplateDraftRecord = {
  id: string
  isEdited: boolean
}

/** Latches a prompt template's edited marker for the remainder of the renderer session. */
export const markPromptTemplateDraftEdited = (
  draft: PromptTemplateDraftRecord
): PromptTemplateDraftRecord => {
  draft.isEdited = true
  return draft
}

// Local-only renderer-session edit markers for prompt templates.
export const promptTemplateDraftCollection = createCollection(
  localOnlyCollectionOptions<PromptTemplateDraftRecord>({
    id: 'prompt-template-drafts',
    getKey: (draft) => draft.id
  })
)
