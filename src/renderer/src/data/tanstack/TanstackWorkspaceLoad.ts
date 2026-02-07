import type {
  TanstackLoadWorkspaceByPathRequest,
  TanstackLoadWorkspaceByPathResult
} from '@shared/tanstack/TanstackWorkspaceLoad'
import { tanstackIpcInvokeWithPayload } from './TanstackIpcInvoke'
import { tanstackPromptFolderCollection } from './TanstackPromptFolderCollection'
import { tanstackWorkspaceCollection } from './TanstackWorkspaceCollection'

export const loadTanstackWorkspaceByPath = async (workspacePath: string): Promise<void> => {
  const result = await tanstackIpcInvokeWithPayload<
    TanstackLoadWorkspaceByPathResult,
    TanstackLoadWorkspaceByPathRequest
  >('tanstack-load-workspace-by-path', {
    workspacePath
  })

  if (!result.success) {
    throw new Error(result.error)
  }

  const previousWorkspace = tanstackWorkspaceCollection.get(result.workspace.id)
  tanstackWorkspaceCollection.utils.upsertAuthoritative(result.workspace)

  for (const promptFolder of result.promptFolders) {
    tanstackPromptFolderCollection.utils.upsertAuthoritative(promptFolder)
  }

  if (!previousWorkspace) {
    return
  }

  const nextPromptFolderIds = new Set(result.workspace.data.promptFolderIds)

  for (const promptFolderId of previousWorkspace.promptFolderIds) {
    if (!nextPromptFolderIds.has(promptFolderId)) {
      tanstackPromptFolderCollection.utils.deleteAuthoritative(promptFolderId)
    }
  }
}
