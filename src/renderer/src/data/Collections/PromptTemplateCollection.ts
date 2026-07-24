import { createCollection } from '@tanstack/svelte-db'
import { isPromptTemplateFull, type PromptTemplate } from '@shared/PromptTemplate'
import { revisionCollectionOptions } from './RevisionCollection'

export const promptTemplateCollection = createCollection(
  revisionCollectionOptions<PromptTemplate>({
    id: 'prompt-templates',
    getKey: (template) => template.id,
    shouldAcceptEqualRevision: ({ currentRecord, nextRecord }) => {
      // Allow a folder load to replace a template summary with its full record.
      return !isPromptTemplateFull(currentRecord) && isPromptTemplateFull(nextRecord)
    }
  })
)
