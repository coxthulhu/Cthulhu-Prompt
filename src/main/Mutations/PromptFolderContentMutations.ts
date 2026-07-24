import {
  MARKDOWN_CONTENT_KINDS,
  getMarkdownContentIds
} from '@shared/MarkdownContent'
import type { PromptFolderKind } from '@shared/PromptFolder'
import type {
  AtomicDataBuilder,
  AtomicDataTransactionHandle,
  DataStoreKey
} from '../Data/AtomicDataTransaction'
import { data } from '../Data/Data'

type AtomicHandle = AtomicDataTransactionHandle<DataStoreKey, unknown, number | null>

export const collectPromptFolderContentIds = (
  promptFolderIds: string[]
): Record<PromptFolderKind, string[]> => {
  const contentIds: Record<PromptFolderKind, string[]> = { prompt: [], template: [] }
  for (const promptFolderId of promptFolderIds) {
    const promptFolder = data.promptFolder.committedStore.getEntry(promptFolderId)?.committed
    if (!promptFolder) continue
    for (const kind of MARKDOWN_CONTENT_KINDS) {
      contentIds[kind].push(...getMarkdownContentIds(promptFolder, kind))
    }
  }
  return contentIds
}

export const createPromptFolderContentDeleteHandles = (
  tx: AtomicDataBuilder,
  contentIds: Record<PromptFolderKind, string[]>
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
