import type {
  TanstackCreateWorkspacePayload,
  TanstackCreateWorkspaceResponse
} from '@shared/tanstack/TanstackWorkspaceCreate'
import type { TanstackCloseWorkspaceResult } from '@shared/tanstack/TanstackWorkspaceClose'
import { runTanstackLoad } from '../IpcFramework/TanstackLoad'
import { tanstackIpcInvoke, tanstackIpcInvokeWithPayload } from '../IpcFramework/TanstackIpcInvoke'
import { tanstackPromptCollection } from '../Collections/TanstackPromptCollection'
import { tanstackPromptFolderCollection } from '../Collections/TanstackPromptFolderCollection'
import { tanstackWorkspaceCollection } from '../Collections/TanstackWorkspaceCollection'
import {
  getTanstackSelectedWorkspaceId,
  setTanstackSelectedWorkspaceId
} from '../UiState/TanstackWorkspaceSelection.svelte.ts'

const clearSelectedTanstackWorkspaceCollections = (workspaceId: string | null): void => {
  if (!workspaceId) {
    return
  }

  const workspace = tanstackWorkspaceCollection.get(workspaceId)
  if (!workspace) {
    return
  }

  for (const promptFolderId of workspace.promptFolderIds) {
    const promptFolder = tanstackPromptFolderCollection.get(promptFolderId)

    if (promptFolder) {
      for (const promptId of promptFolder.promptIds) {
        tanstackPromptCollection.utils.deleteAuthoritative(promptId)
      }
    }

    tanstackPromptFolderCollection.utils.deleteAuthoritative(promptFolderId)
  }

  tanstackWorkspaceCollection.utils.deleteAuthoritative(workspaceId)
}

export const createTanstackWorkspace = async (
  workspacePath: string,
  includeExamplePrompts: boolean
): Promise<TanstackCreateWorkspaceResponse> => {
  // Special-case payload: tanstack-create-workspace expects command arguments,
  // not a normal TanStack revision mutation payload object.
  return await tanstackIpcInvokeWithPayload<
    TanstackCreateWorkspaceResponse,
    TanstackCreateWorkspacePayload
  >('tanstack-create-workspace', {
    workspacePath,
    includeExamplePrompts
  })
}

export const closeTanstackWorkspace = async (): Promise<void> => {
  const selectedWorkspaceId = getTanstackSelectedWorkspaceId()

  try {
    await runTanstackLoad(() =>
      tanstackIpcInvoke<TanstackCloseWorkspaceResult>('tanstack-close-workspace')
    )
  } finally {
    // Side effect: clear renderer TanStack workspace state when the workspace closes.
    setTanstackSelectedWorkspaceId(null)
    clearSelectedTanstackWorkspaceCollections(selectedWorkspaceId)
  }
}
