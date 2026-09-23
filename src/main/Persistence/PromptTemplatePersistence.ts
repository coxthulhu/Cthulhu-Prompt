import { PromptTemplateStatus } from '@shared/domain/prompt-template/PromptTemplate'
import { getCurrentIsoSecondTimestamp } from '@shared/utilities/isoTimestamp'
import type { PromptTemplatePersisted } from '@shared/domain/prompt-template/PromptTemplate'
import { getPromptDisplayTitle } from '@shared/domain/prompt/promptFallbackTitle'
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
  serializeMarkdown: serializePromptTemplateMarkdown,
  normalizeLoadedData: (template, folderPath) => {
    /** Physical location determines archive membership, matching task loading. */
    const archived = folderPath.split(/[\\/]/).at(-1) === 'Archived'
    /** Active templates do not retain a finalization timestamp. */
    const { finalizedAt, ...content } = template
    return archived
      ? { ...content, status: PromptTemplateStatus.Archived, finalizedAt: finalizedAt ?? getCurrentIsoSecondTimestamp() }
      : { ...content, status: PromptTemplateStatus.Active }
  },
  shouldRewriteNormalizedData: (loaded, normalized) =>
    loaded.status !== normalized.status || loaded.finalizedAt !== normalized.finalizedAt
})
