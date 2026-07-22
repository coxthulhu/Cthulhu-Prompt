import { PromptStatus, type PromptPersisted } from '@shared/Prompt'
import { getCurrentIsoSecondTimestamp } from '@shared/isoTimestamp'
import { getPromptDisplayTitle } from '@shared/promptFallbackTitle'
import { parsePromptMarkdown, serializePromptMarkdown } from './PromptFrontmatter'
import { COMPLETED_PROMPTS_FOLDER_NAME } from './PromptPersistencePaths'
import {
  createMarkdownPersistence,
  readMarkdownModifiedAt,
  type MarkdownPersistenceFields
} from './MarkdownPersistence'

export type PromptPersistenceFields = MarkdownPersistenceFields

const isCompletedPromptFolderName = (folderName: string): boolean => {
  const folderNameParts = folderName.split(/[\\/]/)
  return folderNameParts[folderNameParts.length - 1] === COMPLETED_PROMPTS_FOLDER_NAME
}

const normalizePromptCompletionForFolder = (
  prompt: PromptPersisted,
  isCompletedFolder: boolean
): PromptPersisted => {
  if (isCompletedFolder) {
    if (prompt.status === PromptStatus.Completed && prompt.completedAt) {
      return prompt
    }

    return {
      ...prompt,
      status: PromptStatus.Completed,
      completedAt: getCurrentIsoSecondTimestamp()
    }
  }

  if (
    (prompt.status === PromptStatus.Todo || prompt.status === PromptStatus.InProgress) &&
    !prompt.completedAt
  ) {
    return prompt
  }

  const { completedAt: _completedAt, ...activePrompt } = prompt
  return {
    ...activePrompt,
    status: PromptStatus.Todo
  }
}

const hasSameCompletionMetadata = (left: PromptPersisted, right: PromptPersisted): boolean => {
  return left.status === right.status && left.completedAt === right.completedAt
}

export const readPromptModifiedAt = (persistenceFields: PromptPersistenceFields): string => {
  return readMarkdownModifiedAt(persistenceFields, 'prompt')
}

export const promptPersistence = createMarkdownPersistence<PromptPersisted>({
  kind: 'prompt',
  getDisplayTitle: getPromptDisplayTitle,
  parseMarkdown: parsePromptMarkdown,
  serializeMarkdown: serializePromptMarkdown,
  normalizeLoadedData: (prompt, folderPath) =>
    normalizePromptCompletionForFolder(prompt, isCompletedPromptFolderName(folderPath)),
  shouldRewriteNormalizedData: (loaded, normalized) =>
    !hasSameCompletionMetadata(loaded, normalized)
})
