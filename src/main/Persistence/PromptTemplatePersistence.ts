import type { PromptTemplatePersisted } from '@shared/domain/prompt-template/PromptTemplate'
import {
  parsePromptTemplateMarkdown,
  serializePromptTemplateMarkdown
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

export type PromptTemplatePersistenceFields = MarkdownPersistenceFields

export const readPromptTemplateModifiedAt = (
  persistenceFields: PromptTemplatePersistenceFields
): string => readMarkdownModifiedAt(persistenceFields, 'template')

export const promptTemplatePersistence = createMarkdownPersistence<PromptTemplatePersisted>({
  kind: 'template',
  parseMarkdown: parsePromptTemplateMarkdown,
  serializeMarkdown: serializePromptTemplateMarkdown,
  normalizeLoadedData: (template, folderPath) =>
    normalizeContentForStatusFolder(template, folderPath, 'template'),
  shouldRewriteNormalizedData: hasStatusFolderNormalizationChanges
})
