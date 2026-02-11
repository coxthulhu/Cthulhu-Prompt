import { createCollection } from '@tanstack/svelte-db'
import type { Prompt } from '@shared/Prompt'
import { revisionCollectionOptions } from './RevisionCollection'

export const promptCollection = createCollection(
  revisionCollectionOptions<Prompt>({
    id: 'prompts',
    getKey: (prompt) => prompt.id
  })
)
