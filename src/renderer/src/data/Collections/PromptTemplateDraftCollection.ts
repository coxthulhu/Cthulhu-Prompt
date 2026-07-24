import { createCollection, localOnlyCollectionOptions } from '@tanstack/svelte-db'
import type { PromptTemplateFull } from '@shared/PromptTemplate'

export type PromptTemplateDraftRecord = Omit<PromptTemplateFull, 'loadingState'> & {
  isEdited: boolean
}

export const markPromptTemplateDraftEdited = (
  draft: PromptTemplateDraftRecord
): PromptTemplateDraftRecord => {
  // Latch the marker for the remainder of the renderer session.
  draft.isEdited = true
  return draft
}

export const promptTemplateDraftCollection = createCollection(
  localOnlyCollectionOptions<PromptTemplateDraftRecord>({
    id: 'prompt-template-drafts',
    getKey: (draft) => draft.id
  })
)
