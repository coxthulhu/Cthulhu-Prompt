import type {
  CloseWorkspacePayload,
  CreateWorkspacePayload,
  MovePromptFolderPayload,
  MovePromptFolderResponsePayload
} from '@shared/Workspace'
import type { IpcMutationActionResponse, IpcMutationPayloadResult } from '@shared/IpcResult'
import { removeEntry, resolveEntryInsertIndex, folderEntryRef } from '@shared/OrderContainer'
import type {
  DeletePromptFolderPayload,
  DeletePromptFolderResponsePayload
} from '@shared/PromptFolder'
import { runLoad } from '../IpcFramework/Load'
import { ipcInvokeWithPayload } from '../IpcFramework/IpcRequestInvoke'
import { promptFolderCollection } from '../Collections/PromptFolderCollection'
import { collectPromptFolderGraphIds } from '../Collections/PromptFolderGraph'
import { workspaceCollection } from '../Collections/WorkspaceCollection'
import {
  deletePromptFolderClientStates,
  removePromptFolderClientState
} from '../UiState/PromptFolderClientState'
import {
  getSelectedWorkspaceId,
  setSelectedWorkspaceId
} from '../UiState/WorkspaceSelection.svelte.ts'
import { runRevisionMutation } from '../IpcFramework/RevisionCollections'
import {
  deletePromptFolderContentRecords,
  deletePromptFolderContentsOptimistically
} from './PromptFolderContentMutations'

/** Clears every renderer record owned by one closed workspace. */
const clearSelectedWorkspaceCollections = (workspaceId: string | null): void => {
  if (!workspaceId) return
  /** Workspace being removed from renderer state. */
  const workspace = workspaceCollection.get(workspaceId)
  if (!workspace) return
  /** Complete root-owned entity graph being removed. */
  const graph = collectPromptFolderGraphIds(workspace.entries.map((entry) => entry.id))
  deletePromptFolderContentRecords(graph)
  for (const promptFolderId of graph.promptFolderIds) {
    promptFolderCollection.utils.deleteAuthoritative(promptFolderId)
    removePromptFolderClientState(promptFolderId)
  }
  workspaceCollection.utils.deleteAuthoritative(workspaceId)
}

/** Creates a workspace through the command-style IPC endpoint. */
export const createWorkspace = async (
  workspacePath: string,
  workspaceName: string,
  includeExamplePrompts: boolean
): Promise<IpcMutationActionResponse> =>
  await ipcInvokeWithPayload<IpcMutationActionResponse, CreateWorkspacePayload>(
    'create-workspace',
    { workspacePath, workspaceName, includeExamplePrompts }
  )

/** Closes the selected workspace and clears its renderer graph. */
export const closeWorkspace = async (): Promise<void> => {
  /** Workspace identity retained for cleanup after IPC settles. */
  const selectedWorkspaceId = getSelectedWorkspaceId()
  try {
    await runLoad(() =>
      ipcInvokeWithPayload<IpcMutationActionResponse, CloseWorkspacePayload>('close-workspace', {})
    )
  } finally {
    // Side effect: clear renderer workspace state after closing.
    setSelectedWorkspaceId(null)
    clearSelectedWorkspaceCollections(selectedWorkspaceId)
  }
}

/** Deletes one root prompt folder and every entity it owns. */
export const deletePromptFolder = async (
  workspaceId: string,
  promptFolderId: string
): Promise<void> => {
  /** Workspace that directly owns the root folder. */
  const workspace = workspaceCollection.get(workspaceId)
  /** Root folder selected for deletion. */
  const promptFolder = promptFolderCollection.get(promptFolderId)
  if (!workspace || !promptFolder) throw new Error('Prompt folder not loaded')
  /** Renderer graph removed with the root folder. */
  const graph = collectPromptFolderGraphIds([promptFolderId])

  await runRevisionMutation<DeletePromptFolderResponsePayload>({
    mutateOptimistically: ({ collections }) => {
      collections.workspace.update(workspaceId, (draft) => {
        draft.entries = removeEntry(draft.entries, 'folder', promptFolderId)
      })
      deletePromptFolderContentsOptimistically(collections, graph)
      collections.promptFolder.delete(promptFolderId)
    },
    persistMutations: async ({ entities }) =>
      await ipcInvokeWithPayload<
        IpcMutationPayloadResult<DeletePromptFolderResponsePayload>,
        DeletePromptFolderPayload
      >('delete-prompt-folder', {
        workspace: entities.workspace({ id: workspaceId, data: workspace }),
        promptFolder: entities.promptFolder({ id: promptFolderId, data: promptFolder })
      }),
    handleSuccessOrConflictResponse: (payload) => {
      if (payload.workspace) workspaceCollection.utils.upsertAuthoritative(payload.workspace)
      if (payload.promptFolder) {
        promptFolderCollection.utils.upsertAuthoritative(payload.promptFolder)
      }
    },
    conflictMessage: 'Prompt folder delete conflict',
    onSuccess: () => {
      deletePromptFolderContentRecords(graph)
      promptFolderCollection.utils.deleteAuthoritative(promptFolderId)
      deletePromptFolderClientStates([promptFolderId])
    }
  })
}

/** Reorders one root prompt folder within its workspace. */
export const movePromptFolder = async (
  workspaceId: string,
  promptFolderId: string,
  previousEntryId: string | null
): Promise<void> => {
  /** Workspace whose root order changes. */
  const workspace = workspaceCollection.get(workspaceId)
  if (!workspace) throw new Error('Workspace not loaded')
  /** Root order after removing the dragged folder. */
  const entries = removeEntry(workspace.entries, 'folder', promptFolderId)
  /** Insertion index following the requested root predecessor. */
  const insertIndex = resolveEntryInsertIndex(entries, previousEntryId)
  if (insertIndex === null) throw new Error('Previous entry not found')
  entries.splice(insertIndex, 0, folderEntryRef(promptFolderId))

  await runRevisionMutation<MovePromptFolderResponsePayload>({
    mutateOptimistically: ({ collections }) => {
      collections.workspace.update(workspaceId, (draft) => {
        draft.entries = entries
      })
    },
    persistMutations: async ({ entities, invoke }) =>
      await invoke<{ payload: MovePromptFolderPayload }>('move-prompt-folder', {
        payload: {
          workspace: entities.workspace({ id: workspaceId, data: workspace }),
          promptFolderId,
          previousEntryId
        }
      }),
    handleSuccessOrConflictResponse: (payload) => {
      workspaceCollection.utils.upsertAuthoritative(payload.workspace)
    },
    conflictMessage: 'Prompt folder move conflict'
  })
}
