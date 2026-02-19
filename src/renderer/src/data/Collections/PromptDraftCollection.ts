import { createCollection, localOnlyCollectionOptions } from '@tanstack/svelte-db'
import type { Prompt } from '@shared/Prompt'

export type PromptDraftRecord = {
  id: Prompt['id']
  title: Prompt['title']
  creationDate: Prompt['creationDate']
  lastModifiedDate: Prompt['lastModifiedDate']
  promptText: Prompt['promptText']
  promptFolderCount: Prompt['promptFolderCount']
}

// Local-only UI draft state for prompt title/text editing.
export const promptDraftCollection = createCollection(
  localOnlyCollectionOptions<PromptDraftRecord>({
    id: 'prompt-drafts',
    getKey: (draft) => draft.id
  })
)
