import { getMarkdownContentIds } from '@shared/domain/markdown-content/MarkdownContent'
import type { RevisionEnvelope } from '@shared/ipc/Revision'
import type { PromptPersisted } from '@shared/domain/prompt/Prompt'
import type { PromptCollection } from '@shared/domain/prompt-collection/PromptCollection'
import type { PromptTemplatePersisted } from '@shared/domain/prompt-template/PromptTemplate'
import {
  buildPromptSnapshot,
  buildPromptTemplateSnapshot,
  getLoadedPromptEntries,
  getLoadedPromptTemplateEntries
} from '../Data/DataSnapshotHelpers'

export const loadPromptCollectionMarkdownContents = (
  promptCollections: Array<RevisionEnvelope<PromptCollection>>
): {
  promptIds: string[]
  promptTemplateIds: string[]
  prompts: Array<RevisionEnvelope<PromptPersisted>>
  promptTemplates: Array<RevisionEnvelope<PromptTemplatePersisted>>
} => {
  const promptIds = promptCollections.flatMap((collection) =>
    getMarkdownContentIds(collection.data, 'prompt')
  )
  const promptTemplateIds = promptCollections.flatMap((collection) =>
    getMarkdownContentIds(collection.data, 'template')
  )
  const prompts = getLoadedPromptEntries(promptIds).map(buildPromptSnapshot)
  return {
    promptIds: prompts.map((prompt) => prompt.id),
    promptTemplateIds,
    prompts,
    promptTemplates: getLoadedPromptTemplateEntries(promptTemplateIds).map(
      buildPromptTemplateSnapshot
    )
  }
}
