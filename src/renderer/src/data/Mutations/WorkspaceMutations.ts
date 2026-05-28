import type {
  CloseWorkspacePayload,
  CreateWorkspacePayload,
  MovePromptFolderPayload,
  MovePromptFolderResponsePayload
} from '@shared/Workspace'
import type { IpcMutationActionResponse } from '@shared/IpcResult'
import { runLoad } from '../IpcFramework/Load'
import { ipcInvokeWithPayload } from '../IpcFramework/IpcRequestInvoke'
import { promptCollection } from '../Collections/PromptCollection'
import { promptFolderCollection } from '../Collections/PromptFolderCollection'
import { workspaceCollection } from '../Collections/WorkspaceCollection'
import { removePromptFolderDraft } from '../UiState/PromptFolderDraftMutations.svelte.ts'
import { removePromptDraft } from '../UiState/PromptDraftMutations.svelte.ts'
import { removePromptUiState } from '../UiState/PromptUiStateDraftMutations.svelte.ts'
import {
  getSelectedWorkspaceId,
  setSelectedWorkspaceId
} from '../UiState/WorkspaceSelection.svelte.ts'
import { runRevisionMutation } from '../IpcFramework/RevisionCollections'

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
        removePromptUiState(promptId)
      }
    }

    promptFolderCollection.utils.deleteAuthoritative(promptFolderId)
    removePromptFolderDraft(promptFolderId)
  }

  workspaceCollection.utils.deleteAuthoritative(workspaceId)
}

export const createWorkspace = async (
  workspacePath: string,
  workspaceName: string,
  includeExamplePrompts: boolean
): Promise<IpcMutationActionResponse> => {
  // Special-case payload: create-workspace expects command arguments,
  // not a normal  revision mutation payload object.
  return await ipcInvokeWithPayload<IpcMutationActionResponse, CreateWorkspacePayload>(
    'create-workspace',
    {
      workspacePath,
      workspaceName,
      includeExamplePrompts
    }
  )
}

export const closeWorkspace = async (): Promise<void> => {
  const selectedWorkspaceId = getSelectedWorkspaceId()

  try {
    await runLoad(() =>
      ipcInvokeWithPayload<IpcMutationActionResponse, CloseWorkspacePayload>('close-workspace', {})
    )
  } finally {
    // Side effect: clear renderer  workspace state when the workspace closes.
    setSelectedWorkspaceId(null)
    clearSelectedWorkspaceCollections(selectedWorkspaceId)
  }
}

const resolvePromptFolderInsertIndex = (
  promptFolderIds: string[],
  orderAfterPromptFolderId: string | null
): number | null => {
  if (orderAfterPromptFolderId === null) {
    return 0
  }

  const previousIndex = promptFolderIds.indexOf(orderAfterPromptFolderId)
  return previousIndex === -1 ? null : previousIndex + 1
}

export const movePromptFolder = async (
  workspaceId: string,
  promptFolderId: string,
  orderAfterPromptFolderId: string | null
): Promise<void> => {
  const workspace = workspaceCollection.get(workspaceId)

  if (!workspace) {
    throw new Error('Workspace not loaded')
  }

  const destinationPromptFolderIds = workspace.promptFolderIds.filter(
    (currentPromptFolderId) => currentPromptFolderId !== promptFolderId
  )
  const insertIndex = resolvePromptFolderInsertIndex(
    destinationPromptFolderIds,
    orderAfterPromptFolderId
  )

  if (insertIndex === null) {
    throw new Error('Order-after prompt folder not found')
  }

  const nextPromptFolderIds = [...destinationPromptFolderIds]
  nextPromptFolderIds.splice(insertIndex, 0, promptFolderId)
  await runRevisionMutation<MovePromptFolderResponsePayload>({
    mutateOptimistically: ({ collections }) => {
      collections.workspace.update(workspaceId, (draft) => {
        draft.promptFolderIds = [...nextPromptFolderIds]
      })
    },
    persistMutations: async ({ entities, invoke }) => {
      return await invoke<{ payload: MovePromptFolderPayload }>('move-prompt-folder', {
        payload: {
          workspace: entities.workspace({
            id: workspaceId,
            data: workspace
          }),
          promptFolderId,
          orderAfterPromptFolderId
        }
      })
    },
    handleSuccessOrConflictResponse: (payload) => {
      workspaceCollection.utils.upsertAuthoritative(payload.workspace)
    },
    conflictMessage: 'Prompt folder move conflict'
  })
}
