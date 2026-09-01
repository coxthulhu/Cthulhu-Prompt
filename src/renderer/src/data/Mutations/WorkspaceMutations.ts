import type {
  CloseWorkspacePayload,
  CreateWorkspacePayload
} from '@shared/Workspace'
import type { IpcMutationActionResponse } from '@shared/IpcResult'
import {
  planDeletePromptFolderDomainMutation,
  planMovePromptFolderDomainMutation
} from '@shared/PromptFolderDomainMutations'
import { runLoad } from '../IpcFramework/Load'
import { ipcInvokeWithPayload } from '../IpcFramework/IpcRequestInvoke'
import { promptFolderCollection } from '../Collections/PromptFolderCollection'
import { collectPromptFolderGraphIds } from '../Collections/PromptFolderGraph'
import { workspaceCollection } from '../Collections/WorkspaceCollection'
import { removePromptFolderClientState } from '../UiState/PromptFolderClientState'
import {
  getSelectedWorkspaceId,
  setSelectedWorkspaceId
} from '../UiState/WorkspaceSelection.svelte.ts'
import { runImmediateRendererDomainMutation } from '../IpcFramework/RendererDomainMutation'
import {
  deletePromptFolderContentRecords
} from './PromptFolderContentMutations'
import { promptClientStateCollection } from '../Collections/PromptClientStateCollection'
import { promptTemplateClientStateCollection } from '../Collections/PromptTemplateClientStateCollection'
import { promptFolderClientStateCollection } from '../Collections/PromptFolderClientStateCollection'

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

  /** Loaded client-state IDs removed alongside authoritative root ownership. */
  const promptClientStateIds = [...graph.contentIds.prompt].filter((id) =>
    promptClientStateCollection.has(id)
  )
  /** Loaded template client-state IDs removed alongside authoritative root ownership. */
  const templateClientStateIds = [...graph.contentIds.template].filter((id) =>
    promptTemplateClientStateCollection.has(id)
  )
  /** Loaded root client-state ID removed after the folder mutation succeeds. */
  const hasPromptFolderClientState = promptFolderClientStateCollection.has(promptFolderId)
  /** Shared root deletion command projected by renderer and main process. */
  const command = { workspaceId, promptFolderId }
  await runImmediateRendererDomainMutation({
    mutation: {
      command,
      plan: planDeletePromptFolderDomainMutation
    },
    ipc: { channel: 'delete-prompt-folder' },
    renderer: {
      mutate: ({ collections }) => {
        if (promptClientStateIds.length > 0) {
          collections.promptClientState.delete(promptClientStateIds)
        }
        if (templateClientStateIds.length > 0) {
          collections.promptTemplateClientState.delete(templateClientStateIds)
        }
        if (hasPromptFolderClientState) {
          collections.promptFolderClientState.delete(promptFolderId)
        }
      }
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
  /** Shared root-folder reorder command projected in both processes. */
  const command = { workspaceId, promptFolderId, previousEntryId }
  await runImmediateRendererDomainMutation({
    mutation: { command, plan: planMovePromptFolderDomainMutation },
    ipc: { channel: 'move-prompt-folder' },
    renderer: {}
  })
}
