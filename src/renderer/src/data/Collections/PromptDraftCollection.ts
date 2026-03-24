import { createCollection, localOnlyCollectionOptions } from '@tanstack/svelte-db'
import type { PromptFull } from '@shared/Prompt'

export type PromptDraftRecord = {
  id: PromptFull['id']
  title: PromptFull['title']
  createdAt: PromptFull['createdAt']
  promptText: PromptFull['promptText']
  promptFolderCount: PromptFull['promptFolderCount']
}

// Local-only UI draft state for prompt title/text editing.
export const promptDraftCollection = createCollection(
  localOnlyCollectionOptions<PromptDraftRecord>({
    id: 'prompt-drafts',
    getKey: (draft) => draft.id
  })
)
