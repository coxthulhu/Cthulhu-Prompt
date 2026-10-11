import type { PromptCollectionKind } from '@shared/domain/prompt-collection/PromptCollection'
import { compactGuid } from '@shared/utilities/compactGuid'
import {
  planCreatePromptCollectionDomainMutation,
  planRenamePromptCollectionDomainMutation
} from '@shared/domain/prompt-collection/PromptCollectionDomainMutations'
import { promptCollectionsCollection } from '@renderer/data/Collections/PromptCollectionsCollection'
import { workspaceCollection } from '@renderer/data/Collections/WorkspaceCollection'
import { runImmediateRendererDomainMutation } from '@renderer/data/IpcFramework/RendererDomainMutation'

export const createPromptCollection = async (
  workspaceId: string,
  displayName: string,
  previousEntryId: string | null = null,
  kind: PromptCollectionKind = 'prompt'
): Promise<string> => {
  const workspace = workspaceCollection.get(workspaceId)

  if (!workspace) {
    throw new Error('Workspace not loaded')
  }

  /** Stable client-generated collection identity shared by both process projections. */
  const optimisticPromptCollectionId = compactGuid(crypto.randomUUID())
  /** Shared collection creation command projected in both processes. */
  const command = {
    workspaceId,
    promptCollectionId: optimisticPromptCollectionId,
    displayName,
    previousEntryId,
    kind
  }

  await runImmediateRendererDomainMutation({
    mutation: { command, plan: planCreatePromptCollectionDomainMutation },
    ipc: { channel: 'create-prompt-collection' },
    renderer: {
      mutate: ({ collections }) => {
        collections.promptCollectionClientState.insert({
          id: optimisticPromptCollectionId,
          hasLoadedInitialData: false
        })
      }
    }
  })

  return optimisticPromptCollectionId
}

export const renamePromptCollection = async (
  promptCollectionId: string,
  displayName: string
): Promise<void> => {
  const promptCollection = promptCollectionsCollection.get(promptCollectionId)

  if (!promptCollection) {
    throw new Error('Prompt collection not loaded')
  }

  /** Shared rename command projected optimistically and authoritatively. */
  const command = { promptCollectionId, displayName }
  await runImmediateRendererDomainMutation({
    mutation: { command, plan: planRenamePromptCollectionDomainMutation },
    ipc: { channel: 'rename-prompt-collection' },
    renderer: {}
  })
}
