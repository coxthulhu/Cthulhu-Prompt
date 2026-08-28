import { createCollection, localOnlyCollectionOptions } from '@tanstack/svelte-db'

/** Renderer-session edit marker for one prompt. */
export type PromptDraftRecord = {
  id: string
  isEdited: boolean
}

/** Latches a prompt's edited marker for the remainder of the renderer session. */
export const markPromptDraftEdited = (draft: PromptDraftRecord): PromptDraftRecord => {
  draft.isEdited = true
  return draft
}

// Local-only renderer-session edit markers for prompts.
export const promptDraftCollection = createCollection(
  localOnlyCollectionOptions<PromptDraftRecord>({
    id: 'prompt-drafts',
    getKey: (draft) => draft.id
  })
)
