import { createCollection } from '@tanstack/svelte-db'
import type { TanstackPrompt } from '@shared/tanstack/TanstackPrompt'
import { tanstackRevisionCollectionOptions } from './TanstackRevisionCollection'

export const tanstackPromptCollection = createCollection(
  tanstackRevisionCollectionOptions<TanstackPrompt>({
    id: 'tanstack-prompts',
    getKey: (prompt) => prompt.id
  })
)
