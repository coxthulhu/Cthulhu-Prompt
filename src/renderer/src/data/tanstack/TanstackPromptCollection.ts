import { createCollection, localOnlyCollectionOptions } from '@tanstack/svelte-db'
import type { TanstackPromptRecord } from '@shared/tanstack/TanstackPrompt'

export const tanstackPromptCollection = createCollection(
  localOnlyCollectionOptions<TanstackPromptRecord>({
    // Local-only scaffold while prompt data migration is in progress.
    id: 'tanstack-prompts',
    getKey: (item) => item.id
  })
)
