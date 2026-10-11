import {
  MARKDOWN_CONTENT_KINDS,
  getMarkdownContentIds
} from '@shared/domain/markdown-content/MarkdownContent'
import type { PromptCollectionContentKind } from '@shared/domain/prompt-collection/PromptCollection'
import type {
  AtomicDataBuilder,
  AtomicDataTransactionHandle,
  DataStoreKey
} from '../Data/AtomicDataTransaction'
import { data } from '../Data/Data'

type AtomicHandle = AtomicDataTransactionHandle<DataStoreKey, unknown, number | null>

export const collectPromptCollectionContentIds = (
  promptCollectionIds: string[]
): Record<PromptCollectionContentKind, string[]> => {
  const contentIds: Record<PromptCollectionContentKind, string[]> = { prompt: [], template: [] }
  for (const promptCollectionId of promptCollectionIds) {
    const promptCollection = data.promptCollection.committedStore.getEntry(promptCollectionId)?.committed
    if (!promptCollection) continue
    for (const kind of MARKDOWN_CONTENT_KINDS) {
      contentIds[kind].push(...getMarkdownContentIds(promptCollection, kind))
    }
  }
  return contentIds
}

export const createPromptCollectionContentDeleteHandles = (
  tx: AtomicDataBuilder,
  contentIds: Record<PromptCollectionContentKind, string[]>
): Record<string, AtomicHandle> => ({
  ...Object.fromEntries(
    contentIds.prompt.map((promptId) => [
      `prompt:${promptId}`,
      tx.prompt.delete({ id: promptId })
    ])
  ),
  ...Object.fromEntries(
    contentIds.template.map((templateId) => [
      `promptTemplate:${templateId}`,
      tx.promptTemplate.delete({ id: templateId })
    ])
  )
})
