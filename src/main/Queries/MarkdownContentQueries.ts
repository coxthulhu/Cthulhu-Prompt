import { getMarkdownContentIds } from '@shared/domain/markdown-content/MarkdownContent'
import type { RevisionEnvelope } from '@shared/ipc/Revision'
import type { PromptPersisted } from '@shared/domain/prompt/Prompt'
import type { PromptFolder } from '@shared/domain/prompt-folder/PromptFolder'
import type { PromptTemplatePersisted } from '@shared/domain/prompt-template/PromptTemplate'
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
  promptTemplateIds: string[]
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
    promptTemplateIds,
    prompts,
    promptTemplates: getLoadedPromptTemplateEntries(promptTemplateIds).map(
      buildPromptTemplateSnapshot
    )
  }
}
