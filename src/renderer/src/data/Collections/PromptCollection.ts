import { createCollection } from '@tanstack/svelte-db'
import { isPromptFull, type Prompt } from '@shared/Prompt'
import { revisionCollectionOptions } from './RevisionCollection'

export const promptCollection = createCollection(
  revisionCollectionOptions<Prompt>({
    id: 'prompts',
    getKey: (prompt) => prompt.id,
    shouldAcceptEqualRevision: ({ currentRecord, nextRecord }) => {
      // Allow replacing summary prompt rows with full prompt rows at the same revision.
      return !isPromptFull(currentRecord) && isPromptFull(nextRecord)
    }
  })
)
