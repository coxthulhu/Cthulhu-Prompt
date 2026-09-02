import { getPromptFolderCategoryIds, type PromptFolder } from '@shared/PromptFolder'
import { isFinalPromptStatus, PromptStatusFolderId } from '@shared/Prompt'
import {
  getMarkdownContentIds,
  getOrderedMarkdownContentIds
} from '@shared/MarkdownContent'
import { promptCollection } from './PromptCollection'

export const getPromptFolderAllPromptIds = (promptFolder: PromptFolder): string[] =>
  promptFolder.kind === 'prompt' ? getMarkdownContentIds(promptFolder, 'prompt') : []

export const isPromptFolderEmpty = (promptFolder: PromptFolder): boolean =>
  getMarkdownContentIds(promptFolder, promptFolder.kind).length === 0 &&
  getPromptFolderCategoryIds(promptFolder).length === 0 &&
  Object.values(promptFolder.settings).every((value) => (value ?? '').trim().length === 0)

export const getPromptFolderPromptIds = (promptFolder: PromptFolder): string[] => {
  return getPromptFolderAllPromptIds(promptFolder).filter(
    (promptId) => {
      /** Loaded prompt used to exclude registry-defined final statuses. */
      const prompt = promptCollection.get(promptId)
      return prompt ? !isFinalPromptStatus(prompt.status) : false
    }
  )
}

export const getPromptFolderActiveEntryIds = (promptFolder: PromptFolder): string[] =>
  getOrderedMarkdownContentIds(
    promptFolder,
    promptFolder.kind,
    PromptStatusFolderId.Active
  ).flatMap((entryId) => {
    if (promptFolder.kind === 'template') return [entryId]
    /** Loaded prompt used to exclude registry-defined final statuses. */
    const prompt = promptCollection.get(entryId)
    return prompt && isFinalPromptStatus(prompt.status) ? [] : [entryId]
  })
