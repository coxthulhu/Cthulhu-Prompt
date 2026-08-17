import {
  MARKDOWN_CONTENT_KINDS,
  getMarkdownContentIds
} from '@shared/MarkdownContent'
import {
  getCategoryOrderCategoryIds,
  type PromptFolderContentKind
} from '@shared/PromptFolder'
import { promptFolderCollection } from './PromptFolderCollection'

export type PromptFolderGraphIds = {
  promptFolderIds: Set<string>
  categoryIds: Set<string>
  contentIds: Record<PromptFolderContentKind, Set<string>>
}

export const collectPromptFolderGraphIds = (
  rootPromptFolderIds: Iterable<string>
): PromptFolderGraphIds => {
  const graph: PromptFolderGraphIds = {
    promptFolderIds: new Set<string>(),
    categoryIds: new Set<string>(),
    contentIds: { prompt: new Set<string>(), template: new Set<string>() }
  }
  const visitFolder = (promptFolderId: string): void => {
    if (graph.promptFolderIds.has(promptFolderId)) return
    graph.promptFolderIds.add(promptFolderId)
    const promptFolder = promptFolderCollection.get(promptFolderId)
    if (!promptFolder) return
    for (const categoryId of getCategoryOrderCategoryIds(promptFolder.categoryOrder)) {
      graph.categoryIds.add(categoryId)
    }

    for (const kind of MARKDOWN_CONTENT_KINDS) {
      for (const contentId of getMarkdownContentIds(promptFolder, kind)) {
        graph.contentIds[kind].add(contentId)
      }
    }
  }

  for (const rootPromptFolderId of rootPromptFolderIds) visitFolder(rootPromptFolderId)
  return graph
}
