import { getMarkdownContentIds } from '@shared/MarkdownContent'
import type { RevisionEnvelope } from '@shared/Revision'
import type { PromptPersisted } from '@shared/Prompt'
import type { PromptFolder } from '@shared/PromptFolder'
import type { PromptTemplatePersisted } from '@shared/PromptTemplate'
import {
  buildPromptSnapshot,
  buildPromptTemplateSnapshot,
  getLoadedPromptEntries,
  getLoadedPromptTemplateEntries
} from '../Data/DataSnapshotHelpers'

export const loadPromptFolderMarkdownContents = (
  promptFolders: Array<RevisionEnvelope<PromptFolder>>
): {
  promptIds: string[]
  prompts: Array<RevisionEnvelope<PromptPersisted>>
  promptTemplates: Array<RevisionEnvelope<PromptTemplatePersisted>>
} => {
  const promptIds = promptFolders.flatMap((folder) =>
    getMarkdownContentIds(folder.data, 'prompt')
  )
  const promptTemplateIds = promptFolders.flatMap((folder) =>
    getMarkdownContentIds(folder.data, 'template')
  )
  const prompts = getLoadedPromptEntries(promptIds).map(buildPromptSnapshot)
  return {
    promptIds: prompts.map((prompt) => prompt.id),
    prompts,
    promptTemplates: getLoadedPromptTemplateEntries(promptTemplateIds).map(
      buildPromptTemplateSnapshot
    )
  }
}
