import { createCollection } from '@tanstack/svelte-db'
import type { PromptCollection } from '@shared/domain/prompt-collection/PromptCollection'
import { revisionCollectionOptions } from './RevisionCollection'

export const promptCollectionsCollection = createCollection(
  revisionCollectionOptions<PromptCollection>({
    id: 'prompt-collections',
    getKey: (promptCollection) => promptCollection.id
  })
)
