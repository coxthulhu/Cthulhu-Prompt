import { createCollection } from '@tanstack/svelte-db'
import type { PromptTemplate } from '@shared/PromptTemplate'
import { revisionCollectionOptions } from './RevisionCollection'

export const promptTemplateCollection = createCollection(
  revisionCollectionOptions<PromptTemplate>({
    id: 'prompt-templates',
    getKey: (template) => template.id
  })
)
