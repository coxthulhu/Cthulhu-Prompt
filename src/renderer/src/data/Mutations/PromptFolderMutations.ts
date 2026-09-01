import type { PromptFolderKind } from '@shared/PromptFolder'
import { compactGuid } from '@shared/compactGuid'
import {
  planCreatePromptFolderDomainMutation,
  planRenamePromptFolderDomainMutation
} from '@shared/PromptFolderDomainMutations'
import { promptFolderCollection } from '../Collections/PromptFolderCollection'
import { workspaceCollection } from '../Collections/WorkspaceCollection'
import { runImmediateRendererDomainMutation } from '../IpcFramework/RendererDomainMutation'

export const createPromptFolder = async (
  workspaceId: string,
  displayName: string,
  previousEntryId: string | null = null,
  kind: PromptFolderKind = 'prompt'
): Promise<string> => {
  const workspace = workspaceCollection.get(workspaceId)

  if (!workspace) {
    throw new Error('Workspace not loaded')
  }

  /** Stable client-generated folder identity shared by both process projections. */
  const optimisticPromptFolderId = compactGuid(crypto.randomUUID())
  /** Shared root-folder creation command projected in both processes. */
  const command = {
    workspaceId,
    promptFolderId: optimisticPromptFolderId,
    displayName,
    previousEntryId,
    kind
  }

  await runImmediateRendererDomainMutation({
    mutation: { command, plan: planCreatePromptFolderDomainMutation },
    ipc: { channel: 'create-prompt-folder' },
    renderer: {
      mutate: ({ collections }) => {
        collections.promptFolderClientState.insert({
          id: optimisticPromptFolderId,
          hasLoadedInitialData: false
        })
      }
    }
  })

  return optimisticPromptFolderId
}

export const renamePromptFolder = async (
  promptFolderId: string,
  displayName: string
): Promise<void> => {
  const promptFolder = promptFolderCollection.get(promptFolderId)

  if (!promptFolder) {
    throw new Error('Prompt folder not loaded')
  }

  /** Shared rename command projected optimistically and authoritatively. */
  const command = { promptFolderId, displayName }
  await runImmediateRendererDomainMutation({
    mutation: { command, plan: planRenamePromptFolderDomainMutation },
    ipc: { channel: 'rename-prompt-folder' },
    renderer: {}
  })
}
