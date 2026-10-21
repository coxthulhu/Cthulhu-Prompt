import type {
  CloseWorkspacePayload,
  CreateWorkspacePayload
} from '@shared/domain/workspace/Workspace'
import { planSetCollectionFavorite, planMoveCollectionFavorite } from '@shared/domain/workspace/CollectionFavoritesDomainMutations'
import type { IpcMutationActionResponse } from '@shared/ipc/IpcResult'
import {
  planDeletePromptCollectionDomainMutation,
  planMovePromptCollectionDomainMutation
} from '@shared/domain/prompt-collection/PromptCollectionDomainMutations'
import { runLoad } from '@renderer/data/IpcFramework/Load'
import { ipcInvokeWithPayload } from '@renderer/data/IpcFramework/IpcRequestInvoke'
import { promptCollectionsCollection } from '@renderer/data/Collections/PromptCollectionsCollection'
import { collectPromptCollectionGraphIds } from '@renderer/data/Collections/PromptCollectionGraph'
import { workspaceCollection } from '@renderer/data/Collections/WorkspaceCollection'
import { setSelectedWorkspaceId } from '@renderer/app/workspaceSelection.svelte.ts'
import { runImmediateRendererDomainMutation } from '@renderer/data/IpcFramework/RendererDomainMutation'
import { promptClientStateCollection } from '@renderer/data/Collections/PromptClientStateCollection'
import { promptTemplateClientStateCollection } from '@renderer/data/Collections/PromptTemplateClientStateCollection'
import { promptCollectionClientStateCollection } from '@renderer/data/Collections/PromptCollectionClientStateCollection'
import { clearWorkspaceData } from '@renderer/data/UiState/workspace/clearWorkspaceData'
import { submitAllPacedUpdateTransactionsAndWait } from '@renderer/data/IpcFramework/RevisionCollections'
import { waitForRevisionMutations } from '@renderer/data/IpcFramework/RevisionMutation'

/** Saves favorite membership through the shared optimistic workspace mutation flow. */
export const setCollectionFavorite = async (workspaceId: string, promptCollectionId: string, favorite: boolean): Promise<void> => {
  await runImmediateRendererDomainMutation({
    mutation: { command: { workspaceId, promptCollectionId, favorite }, plan: planSetCollectionFavorite },
    ipc: { channel: 'set-collection-favorite' }, renderer: {}
  })
}

/** Persists a favorite's position independently from All Collections. */
export const moveCollectionFavorite = async (workspaceId: string, promptCollectionId: string, previousEntryId: string | null): Promise<void> => {
  await runImmediateRendererDomainMutation({
    mutation: { command: { workspaceId, promptCollectionId, previousEntryId }, plan: planMoveCollectionFavorite },
    ipc: { channel: 'move-collection-favorite' }, renderer: {}
  })
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

/** Deletes one prompt collection and every entity it owns. */
export const deletePromptCollection = async (
  workspaceId: string,
  promptCollectionId: string
): Promise<void> => {
  /** Workspace that directly owns the collection. */
  const workspace = workspaceCollection.get(workspaceId)
  /** collection selected for deletion. */
  const promptCollection = promptCollectionsCollection.get(promptCollectionId)
  if (!workspace || !promptCollection) throw new Error('Prompt collection not loaded')
  /** Renderer graph removed with the collection. */
  const graph = collectPromptCollectionGraphIds([promptCollectionId])

  /** Loaded client-state IDs removed alongside authoritative collection ownership. */
  const promptClientStateIds = [...graph.contentIds.prompt].filter((id) =>
    promptClientStateCollection.has(id)
  )
  /** Loaded template client-state IDs removed alongside authoritative collection ownership. */
  const templateClientStateIds = [...graph.contentIds.template].filter((id) =>
    promptTemplateClientStateCollection.has(id)
  )
  /** Loaded collection client-state ID removed after the collection mutation succeeds. */
  const hasPromptCollectionClientState = promptCollectionClientStateCollection.has(promptCollectionId)
  /** Shared collection deletion command projected by renderer and main process. */
  const command = { workspaceId, promptCollectionId }
  await runImmediateRendererDomainMutation({
    mutation: {
      command,
      plan: planDeletePromptCollectionDomainMutation
    },
    ipc: { channel: 'delete-prompt-collection' },
    renderer: {
      mutate: ({ collections }) => {
        if (promptClientStateIds.length > 0) {
          collections.promptClientState.delete(promptClientStateIds)
        }
        if (templateClientStateIds.length > 0) {
          collections.promptTemplateClientState.delete(templateClientStateIds)
        }
        if (hasPromptCollectionClientState) {
          collections.promptCollectionClientState.delete(promptCollectionId)
        }
      }
    }
  })
}

/** Reorders one prompt collection within its workspace. */
export const movePromptCollection = async (
  workspaceId: string,
  promptCollectionId: string,
  previousEntryId: string | null
): Promise<void> => {
  /** Workspace whose collection order changes. */
  const workspace = workspaceCollection.get(workspaceId)
  if (!workspace) throw new Error('Workspace not loaded')
  /** Shared collection reorder command projected in both processes. */
  const command = { workspaceId, promptCollectionId, previousEntryId }
  await runImmediateRendererDomainMutation({
    mutation: { command, plan: planMovePromptCollectionDomainMutation },
    ipc: { channel: 'move-prompt-collection' },
    renderer: {}
  })
}
