import { getStandaloneNoteIds } from '@shared/domain/note/Note'
import { getPromptCollectionCategoryIds, type PromptCollection } from '@shared/domain/prompt-collection/PromptCollection'
import { isFinalPromptStatus, PromptStatusFolderId } from '@shared/domain/prompt/Prompt'
import {
  getMarkdownContentIds,
  getOrderedMarkdownContentIds
} from '@shared/domain/markdown-content/MarkdownContent'
import { promptsCollection } from './PromptsCollection'

export const getPromptCollectionAllPromptIds = (promptCollection: PromptCollection): string[] =>
  promptCollection.kind === 'prompt' ? getMarkdownContentIds(promptCollection, 'prompt') : []

export const isPromptCollectionEmpty = (promptCollection: PromptCollection): boolean =>
  getStandaloneNoteIds(promptCollection).length === 0 &&
  getMarkdownContentIds(promptCollection, promptCollection.kind).length === 0 &&
  getPromptCollectionCategoryIds(promptCollection).length === 0 &&
  Object.values(promptCollection.settings).every((value) => (value ?? '').trim().length === 0)

export const getPromptCollectionPromptIds = (promptCollection: PromptCollection): string[] => {
  return getPromptCollectionAllPromptIds(promptCollection).filter(
    (promptId) => {
      /** Loaded prompt used to exclude registry-defined final statuses. */
      const prompt = promptsCollection.get(promptId)
      return prompt ? !isFinalPromptStatus(prompt.status) : false
    }
  )
}

export const getPromptCollectionActiveEntryIds = (promptCollection: PromptCollection): string[] =>
  getOrderedMarkdownContentIds(
    promptCollection,
    promptCollection.kind,
    PromptStatusFolderId.Active
  ).flatMap((entryId) => {
    if (promptCollection.kind === 'template') return [entryId]
    /** Loaded prompt used to exclude registry-defined final statuses. */
    const prompt = promptsCollection.get(entryId)
    return prompt && isFinalPromptStatus(prompt.status) ? [] : [entryId]
  })
