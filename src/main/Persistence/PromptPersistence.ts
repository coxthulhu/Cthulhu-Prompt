import type { PromptPersisted } from '@shared/domain/prompt/Prompt'
import {
  parsePromptMarkdown,
  serializePromptMarkdown
} from './PromptFrontmatter'
import {
  createMarkdownPersistence,
  readMarkdownModifiedAt,
  type MarkdownPersistenceFields
} from './MarkdownPersistence'
import {
  hasStatusFolderNormalizationChanges,
  normalizeContentForStatusFolder
} from './StatusFolderNormalization'

export type PromptPersistenceFields = MarkdownPersistenceFields

export const readPromptModifiedAt = (persistenceFields: PromptPersistenceFields): string => {
  return readMarkdownModifiedAt(persistenceFields, 'prompt')
}

export const promptPersistence = createMarkdownPersistence<PromptPersisted>({
  kind: 'prompt',
  parseMarkdown: parsePromptMarkdown,
  serializeMarkdown: serializePromptMarkdown,
  normalizeLoadedData: (prompt, folderPath) =>
    normalizeContentForStatusFolder(prompt, folderPath, 'prompt'),
  shouldRewriteNormalizedData: hasStatusFolderNormalizationChanges
})
