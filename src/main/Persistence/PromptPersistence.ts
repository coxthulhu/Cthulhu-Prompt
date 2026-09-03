import {
  getPromptStatusFolderDefinition,
  PROMPT_STATUS_FOLDERS,
  PromptStatus,
  type PromptPersisted
} from '@shared/Prompt'
import { getCurrentIsoSecondTimestamp } from '@shared/isoTimestamp'
import { getPromptDisplayTitle } from '@shared/promptFallbackTitle'
import {
  parsePromptMarkdown,
  promptMarkdownHasLegacyTemplateId,
  serializePromptMarkdown
} from './PromptFrontmatter'
import {
  createMarkdownPersistence,
  readMarkdownModifiedAt,
  type MarkdownPersistenceFields
} from './MarkdownPersistence'

export type PromptPersistenceFields = MarkdownPersistenceFields

const getPromptStatusFolderForDirectory = (folderName: string) => {
  const folderNameParts = folderName.split(/[\\/]/)
  const finalFolderName = folderNameParts[folderNameParts.length - 1]
  /** Registry definition whose directory name matches the persisted parent folder. */
  const statusFolder = PROMPT_STATUS_FOLDERS.find(
    (candidate) => candidate.directoryName === finalFolderName
  )
  return statusFolder ?? getPromptStatusFolderDefinition(PromptStatus.Todo)
}

const normalizePromptStatusForFolder = (
  prompt: PromptPersisted,
  folderName: string
): PromptPersisted => {
  /** Registry definition owning the physical directory being loaded. */
  const statusFolder = getPromptStatusFolderForDirectory(folderName)
  if (statusFolder.isFinal) {
    if (
      (statusFolder.statuses as readonly PromptStatus[]).includes(prompt.status) &&
      prompt.finalizedAt
    ) {
      return prompt
    }

    return {
      ...prompt,
      status: statusFolder.statuses[0]!,
      finalizedAt: getCurrentIsoSecondTimestamp()
    }
  }

  if (
    (statusFolder.statuses as readonly PromptStatus[]).includes(prompt.status) &&
    !prompt.finalizedAt
  ) {
    return prompt
  }

  const { finalizedAt: _finalizedAt, ...activePrompt } = prompt
  return {
    ...activePrompt,
    status: statusFolder.statuses[0]!
  }
}

const hasSameStatusMetadata = (left: PromptPersisted, right: PromptPersisted): boolean => {
  return left.status === right.status && left.finalizedAt === right.finalizedAt
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
    normalizePromptStatusForFolder(prompt, folderPath),
  shouldRewriteNormalizedData: (loaded, normalized, fileText) =>
    !hasSameStatusMetadata(loaded, normalized) ||
    promptMarkdownHasLegacyTemplateId(fileText)
})
