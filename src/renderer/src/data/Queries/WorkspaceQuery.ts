import type { LoadWorkspaceByPathRequest, LoadWorkspaceByPathResult } from '@shared/Workspace'
import { ipcInvokeWithPayload } from '../IpcFramework/IpcRequestInvoke'
import { runLoad } from '../IpcFramework/Load'
import { promptFolderCollection } from '../Collections/PromptFolderCollection'
import { collectPromptFolderGraphIds } from '../Collections/PromptFolderGraph'
import {
  deletePromptFolderClientStates,
  upsertPromptFolderClientStates
} from '../UiState/PromptFolderClientState'
import { workspaceCollection } from '../Collections/WorkspaceCollection'
import { markdownContentQueryAdapters } from './MarkdownContentQueryAdapters'
import { categoryCollection } from '../Collections/CategoryCollection'

export const loadWorkspaceByPath = async (workspaceInfoPath: string): Promise<string> => {
  const result = await runLoad(() =>
    ipcInvokeWithPayload<LoadWorkspaceByPathResult, LoadWorkspaceByPathRequest>(
      'load-workspace-by-path',
      {
        workspaceInfoPath
      }
    )
  )

  const previousWorkspace = workspaceCollection.get(result.workspace.id)
  const previousGraph = previousWorkspace
    ? collectPromptFolderGraphIds(previousWorkspace.entries.map((entry) => entry.id))
    : null

  workspaceCollection.utils.upsertAuthoritative(result.workspace)
  categoryCollection.utils.upsertManyAuthoritative(result.categories)

  for (const promptFolder of result.promptFolders) {
    promptFolderCollection.utils.upsertAuthoritative(promptFolder)
  }
  upsertPromptFolderClientStates(result.promptFolders.map((promptFolder) => promptFolder.id))
  for (const adapter of markdownContentQueryAdapters) adapter.applyWorkspaceResult(result)

  if (!previousGraph) {
    return result.workspace.id
  }

  const nextPromptFolderIds = new Set(result.promptFolders.map((folder) => folder.id))
  const removedPromptFolderIds: string[] = []

  for (const promptFolderId of previousGraph.promptFolderIds) {
    if (!nextPromptFolderIds.has(promptFolderId)) {
      promptFolderCollection.utils.deleteAuthoritative(promptFolderId)
      removedPromptFolderIds.push(promptFolderId)
    }
  }
  deletePromptFolderClientStates(removedPromptFolderIds)

  const nextCategoryIds = new Set(result.categories.map((category) => category.id))
  const removedCategoryIds = [...previousGraph.categoryIds].filter(
    (categoryId) => !nextCategoryIds.has(categoryId)
  )
  categoryCollection.utils.deleteManyAuthoritative(removedCategoryIds)

  for (const adapter of markdownContentQueryAdapters) {
    const nextContentIds = adapter.getWorkspaceIds(result)
    const removedContentIds = [...previousGraph.contentIds[adapter.kind]].filter(
      (contentId) => !nextContentIds.has(contentId)
    )
    adapter.delete(removedContentIds)
  }

  return result.workspace.id
}
