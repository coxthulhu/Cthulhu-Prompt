import type { PromptTemplatePersisted } from '@shared/PromptTemplate'
import { getPromptDisplayTitle } from '@shared/promptFallbackTitle'
import {
  parsePromptTemplateMarkdown,
  serializePromptTemplateMarkdown
} from './PromptFrontmatter'
import {
  createMarkdownPersistence,
  readMarkdownModifiedAt,
  type MarkdownPersistenceFields
} from './MarkdownPersistence'

export type PromptTemplatePersistenceFields = MarkdownPersistenceFields

export const readPromptTemplateModifiedAt = (
  persistenceFields: PromptTemplatePersistenceFields
): string => readMarkdownModifiedAt(persistenceFields, 'template')

export const promptTemplatePersistence = createMarkdownPersistence<PromptTemplatePersisted>({
  kind: 'template',
  getDisplayTitle: getPromptDisplayTitle,
  parseMarkdown: parsePromptTemplateMarkdown,
  serializeMarkdown: serializePromptTemplateMarkdown
})
