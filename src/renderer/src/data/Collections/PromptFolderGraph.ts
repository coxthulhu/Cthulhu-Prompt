import {
  MARKDOWN_CONTENT_KINDS,
  getMarkdownContentIds
} from '@shared/MarkdownContent'
import type { PromptFolderKind } from '@shared/PromptFolder'
import { promptFolderCollection } from './PromptFolderCollection'

export type PromptFolderGraphIds = {
  promptFolderIds: Set<string>
  contentIds: Record<PromptFolderKind, Set<string>>
}

export const collectPromptFolderGraphIds = (
  rootPromptFolderIds: Iterable<string>
): PromptFolderGraphIds => {
  const graph: PromptFolderGraphIds = {
    promptFolderIds: new Set<string>(),
    contentIds: { prompt: new Set<string>(), template: new Set<string>() }
  }
  const visitFolder = (promptFolderId: string): void => {
    if (graph.promptFolderIds.has(promptFolderId)) return
    graph.promptFolderIds.add(promptFolderId)
    const promptFolder = promptFolderCollection.get(promptFolderId)
    if (!promptFolder) return

    for (const kind of MARKDOWN_CONTENT_KINDS) {
      for (const contentId of getMarkdownContentIds(promptFolder, kind)) {
        graph.contentIds[kind].add(contentId)
      }
    }
    for (const entry of promptFolder.entries) {
      if (entry.kind === 'folder') visitFolder(entry.id)
    }
  }

  for (const rootPromptFolderId of rootPromptFolderIds) visitFolder(rootPromptFolderId)
  return graph
}
