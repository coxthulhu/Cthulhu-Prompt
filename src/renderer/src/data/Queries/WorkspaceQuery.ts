import type {
  LoadWorkspaceByPathRequest,
  LoadWorkspaceByPathResult
} from '@shared/Workspace'
import { ipcInvokeWithPayload } from '../IpcFramework/IpcInvoke'
import { runLoad } from '../IpcFramework/Load'
import { promptFolderCollection } from '../Collections/PromptFolderCollection'
import {
  deletePromptFolderDrafts,
  upsertPromptFolderDrafts
} from '../UiState/PromptFolderDraftMutations.svelte.ts'
import { workspaceCollection } from '../Collections/WorkspaceCollection'

export const loadWorkspaceByPath = async (workspacePath: string): Promise<string> => {
  const result = await runLoad(() =>
    ipcInvokeWithPayload<
      LoadWorkspaceByPathResult,
      LoadWorkspaceByPathRequest
    >('load-workspace-by-path', {
      workspacePath
    })
  )

  const previousWorkspace = workspaceCollection.get(result.workspace.id)
  workspaceCollection.utils.upsertAuthoritative(result.workspace)

  for (const promptFolder of result.promptFolders) {
    promptFolderCollection.utils.upsertAuthoritative(promptFolder)
  }
  upsertPromptFolderDrafts(result.promptFolders.map((promptFolder) => promptFolder.data))

  if (!previousWorkspace) {
    return result.workspace.id
  }

  const nextPromptFolderIds = new Set(result.workspace.data.promptFolderIds)
  const removedPromptFolderIds: string[] = []

  for (const promptFolderId of previousWorkspace.promptFolderIds) {
    if (!nextPromptFolderIds.has(promptFolderId)) {
      promptFolderCollection.utils.deleteAuthoritative(promptFolderId)
      removedPromptFolderIds.push(promptFolderId)
    }
  }
  deletePromptFolderDrafts(removedPromptFolderIds)

  return result.workspace.id
}
