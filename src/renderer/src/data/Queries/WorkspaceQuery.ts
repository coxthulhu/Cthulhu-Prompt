import type { LoadWorkspaceByPathRequest, LoadWorkspaceByPathResult } from '@shared/Workspace'
import { ipcInvokeWithPayload } from '../IpcFramework/IpcRequestInvoke'
import { runLoad } from '../IpcFramework/Load'
import { promptFolderCollection } from '../Collections/PromptFolderCollection'
import { collectPromptFolderGraphIds } from '../Collections/PromptFolderGraph'
import {
  deletePromptFolderDrafts,
  upsertPromptFolderDrafts
} from '../UiState/PromptFolderDraftMutations.svelte.ts'
import { workspaceCollection } from '../Collections/WorkspaceCollection'
import { markdownContentQueryAdapters } from './MarkdownContentQueryAdapters'

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

  for (const promptFolder of result.promptFolders) {
    promptFolderCollection.utils.upsertAuthoritative(promptFolder)
  }
  upsertPromptFolderDrafts(result.promptFolders.map((promptFolder) => promptFolder.data))
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
  deletePromptFolderDrafts(removedPromptFolderIds)

  for (const adapter of markdownContentQueryAdapters) {
    const nextContentIds = adapter.getWorkspaceIds(result)
    const removedContentIds = [...previousGraph.contentIds[adapter.kind]].filter(
      (contentId) => !nextContentIds.has(contentId)
    )
    adapter.delete(removedContentIds)
  }

  return result.workspace.id
}
