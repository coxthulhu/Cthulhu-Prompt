import type {
  CloseWorkspacePayload,
  CreateWorkspacePayload
} from '@shared/domain/workspace/Workspace'
import type { IpcMutationActionResponse } from '@shared/ipc/IpcResult'
import {
  planDeletePromptFolderDomainMutation,
  planMovePromptFolderDomainMutation
} from '@shared/domain/prompt-folder/PromptFolderDomainMutations'
import { runLoad } from '@renderer/data/IpcFramework/Load'
import { ipcInvokeWithPayload } from '@renderer/data/IpcFramework/IpcRequestInvoke'
import { promptFolderCollection } from '@renderer/data/Collections/PromptFolderCollection'
import { collectPromptFolderGraphIds } from '@renderer/data/Collections/PromptFolderGraph'
import { workspaceCollection } from '@renderer/data/Collections/WorkspaceCollection'
import { setSelectedWorkspaceId } from '@renderer/app/workspaceSelection.svelte.ts'
import { runImmediateRendererDomainMutation } from '@renderer/data/IpcFramework/RendererDomainMutation'
import { promptClientStateCollection } from '@renderer/data/Collections/PromptClientStateCollection'
import { promptTemplateClientStateCollection } from '@renderer/data/Collections/PromptTemplateClientStateCollection'
import { promptFolderClientStateCollection } from '@renderer/data/Collections/PromptFolderClientStateCollection'
import { clearWorkspaceData } from '@renderer/data/UiState/workspace/clearWorkspaceData'
import { submitAllPacedUpdateTransactionsAndWait } from '@renderer/data/IpcFramework/RevisionCollections'
import { waitForRevisionMutations } from '@renderer/data/IpcFramework/RevisionMutation'

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

/** Flushes pending writes before releasing all workspace memory in both processes. */
export const closeWorkspace = async (): Promise<void> => {
  await submitAllPacedUpdateTransactionsAndWait()
  await waitForRevisionMutations()
  await runLoad(() =>
    ipcInvokeWithPayload<IpcMutationActionResponse, CloseWorkspacePayload>('close-workspace', {})
  )
  setSelectedWorkspaceId(null)
  clearWorkspaceData()
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
