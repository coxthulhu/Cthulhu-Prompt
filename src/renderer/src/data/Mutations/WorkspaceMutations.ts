import type {
  CloseWorkspacePayload,
  CreateWorkspacePayload
} from '@shared/Workspace'
import type { IpcMutationActionResponse } from '@shared/IpcResult'
import { runLoad } from '../IpcFramework/Load'
import { ipcInvokeWithPayload } from '../IpcFramework/IpcInvoke'
import { promptCollection } from '../Collections/PromptCollection'
import { promptFolderCollection } from '../Collections/PromptFolderCollection'
import { workspaceCollection } from '../Collections/WorkspaceCollection'
import { removePromptFolderDraft } from '../UiState/PromptFolderDraftStore.svelte.ts'
import { removePromptDraft } from '../UiState/PromptDraftStore.svelte.ts'
import {
  getSelectedWorkspaceId,
  setSelectedWorkspaceId
} from '../UiState/WorkspaceSelection.svelte.ts'

const clearSelectedWorkspaceCollections = (workspaceId: string | null): void => {
  if (!workspaceId) {
    return
  }

  const workspace = workspaceCollection.get(workspaceId)
  if (!workspace) {
    return
  }

  for (const promptFolderId of workspace.promptFolderIds) {
    const promptFolder = promptFolderCollection.get(promptFolderId)

    if (promptFolder) {
      for (const promptId of promptFolder.promptIds) {
        promptCollection.utils.deleteAuthoritative(promptId)
        removePromptDraft(promptId)
      }
    }

    promptFolderCollection.utils.deleteAuthoritative(promptFolderId)
    removePromptFolderDraft(promptFolderId)
  }

  workspaceCollection.utils.deleteAuthoritative(workspaceId)
}

export const createWorkspace = async (
  workspacePath: string,
  includeExamplePrompts: boolean
): Promise<IpcMutationActionResponse> => {
  // Special-case payload: create-workspace expects command arguments,
  // not a normal  revision mutation payload object.
  return await ipcInvokeWithPayload<
    IpcMutationActionResponse,
    CreateWorkspacePayload
  >('create-workspace', {
    workspacePath,
    includeExamplePrompts
  })
}

export const closeWorkspace = async (): Promise<void> => {
  const selectedWorkspaceId = getSelectedWorkspaceId()

  try {
    await runLoad(() =>
      ipcInvokeWithPayload<IpcMutationActionResponse, CloseWorkspacePayload>(
        'close-workspace',
        {}
      )
    )
  } finally {
    // Side effect: clear renderer  workspace state when the workspace closes.
    setSelectedWorkspaceId(null)
    clearSelectedWorkspaceCollections(selectedWorkspaceId)
  }
}
