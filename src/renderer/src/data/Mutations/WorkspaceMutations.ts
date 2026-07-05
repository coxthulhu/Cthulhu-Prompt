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
import { getPromptFolderPromptIds } from '../Collections/PromptFolderEntries'
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
      for (const promptId of getPromptFolderPromptIds(promptFolder)) {
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
  previousEntryId: string | null
): number | null => {
  if (previousEntryId === null) {
    return 0
  }

  const previousIndex = promptFolderIds.indexOf(previousEntryId)
  return previousIndex === -1 ? null : previousIndex + 1
}

export const movePromptFolder = async (
  workspaceId: string,
  promptFolderId: string,
  previousEntryId: string | null,
  destinationParentPromptFolderId: string | null = null
): Promise<void> => {
  const workspace = workspaceCollection.get(workspaceId)

  if (!workspace) {
    throw new Error('Workspace not loaded')
  }

  const promptFolder = promptFolderCollection.get(promptFolderId)

  if (!promptFolder) {
    throw new Error('Prompt folder not loaded')
  }

  const sourceParentPromptFolderId = promptFolder.parentPromptFolderId
  const sourceParentPromptFolder = sourceParentPromptFolderId
    ? promptFolderCollection.get(sourceParentPromptFolderId)
    : null
  const destinationParentPromptFolder = destinationParentPromptFolderId
    ? promptFolderCollection.get(destinationParentPromptFolderId)
    : null

  if (sourceParentPromptFolderId && !sourceParentPromptFolder) {
    throw new Error('Source parent prompt folder not loaded')
  }

  if (destinationParentPromptFolderId && !destinationParentPromptFolder) {
    throw new Error('Destination parent prompt folder not loaded')
  }

  const isSameParent = sourceParentPromptFolderId === destinationParentPromptFolderId
  const sourceEntryIds = sourceParentPromptFolder?.entryIds ?? workspace.promptFolderIds
  const destinationEntryIds = isSameParent
    ? sourceEntryIds.filter((currentPromptFolderId) => currentPromptFolderId !== promptFolderId)
    : (destinationParentPromptFolder?.entryIds ?? workspace.promptFolderIds)
  const insertIndex = resolvePromptFolderInsertIndex(destinationEntryIds, previousEntryId)

  if (insertIndex === null) {
    throw new Error('Previous entry not found')
  }

  const nextDestinationEntryIds = [...destinationEntryIds]
  nextDestinationEntryIds.splice(insertIndex, 0, promptFolderId)
  await runRevisionMutation<MovePromptFolderResponsePayload>({
    mutateOptimistically: ({ collections }) => {
      if (sourceParentPromptFolderId === null && destinationParentPromptFolderId === null) {
        collections.workspace.update(workspaceId, (draft) => {
          draft.promptFolderIds = [...nextDestinationEntryIds]
        })
        return
      }

      if (isSameParent && sourceParentPromptFolderId) {
        collections.promptFolder.update(sourceParentPromptFolderId, (draft) => {
          draft.entryIds = [...nextDestinationEntryIds]
        })
        return
      }

      if (sourceParentPromptFolderId) {
        collections.promptFolder.update(sourceParentPromptFolderId, (draft) => {
          draft.entryIds = draft.entryIds.filter((entryId) => entryId !== promptFolderId)
        })
      } else {
        collections.workspace.update(workspaceId, (draft) => {
          draft.promptFolderIds = draft.promptFolderIds.filter(
            (currentPromptFolderId) => currentPromptFolderId !== promptFolderId
          )
        })
      }

      if (destinationParentPromptFolderId) {
        collections.promptFolder.update(destinationParentPromptFolderId, (draft) => {
          draft.entryIds = [...nextDestinationEntryIds]
        })
      } else {
        collections.workspace.update(workspaceId, (draft) => {
          draft.promptFolderIds = [...nextDestinationEntryIds]
        })
      }

      collections.promptFolder.update(promptFolderId, (draft) => {
        draft.parentPromptFolderId = destinationParentPromptFolderId
        draft.depth = destinationParentPromptFolder ? destinationParentPromptFolder.depth + 1 : 0
      })
    },
    persistMutations: async ({ entities, invoke }) => {
      return await invoke<{ payload: MovePromptFolderPayload }>('move-prompt-folder', {
        payload: {
          workspace: entities.workspace({
            id: workspaceId,
            data: workspace
          }),
          sourceParentPromptFolder: sourceParentPromptFolderId
            ? entities.promptFolder({
                id: sourceParentPromptFolderId,
                data: sourceParentPromptFolder!
              })
            : null,
          destinationParentPromptFolder: destinationParentPromptFolderId
            ? entities.promptFolder({
                id: destinationParentPromptFolderId,
                data: destinationParentPromptFolder!
              })
            : null,
          promptFolderId,
          previousEntryId
        }
      })
    },
    handleSuccessOrConflictResponse: (payload) => {
      workspaceCollection.utils.upsertAuthoritative(payload.workspace)
      promptFolderCollection.utils.upsertManyAuthoritative(payload.promptFolders)
    },
    conflictMessage: 'Prompt folder move conflict'
  })
}
