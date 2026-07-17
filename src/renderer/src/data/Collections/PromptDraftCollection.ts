import { createCollection, localOnlyCollectionOptions } from '@tanstack/svelte-db'
import type { PromptFull } from '@shared/Prompt'

export type PromptDraftRecord = {
  id: PromptFull['id']
  title: PromptFull['title']
  fallbackTitle: PromptFull['fallbackTitle']
  createdAt: PromptFull['createdAt']
  modifiedAt: PromptFull['modifiedAt']
  promptText: PromptFull['promptText']
  isEdited: boolean
}

export const markPromptDraftEdited = (draft: PromptDraftRecord): PromptDraftRecord => {
  // Latch the marker for the remainder of the renderer session.
  draft.isEdited = true
  return draft
}

// Local-only UI draft state for prompt editing and its session marker.
export const promptDraftCollection = createCollection(
  localOnlyCollectionOptions<PromptDraftRecord>({
    id: 'prompt-drafts',
    getKey: (draft) => draft.id
  })
)
