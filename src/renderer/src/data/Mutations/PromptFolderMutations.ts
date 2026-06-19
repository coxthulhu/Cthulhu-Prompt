import {
  copyPromptFolderSettings,
  createEmptyPromptFolderSettings,
  type CreatePromptFolderPayload,
  type CreatePromptFolderResponsePayload,
  type PromptFolder,
  type PromptFolderRevisionResponsePayload,
  type UpdatePromptFolderSettingsPayload
} from '@shared/PromptFolder'
import type { IpcMutationPayloadResult } from '@shared/IpcResult'
import { compactGuid } from '@shared/compactGuid'
import type { Transaction } from '@tanstack/svelte-db'
import { preparePromptFolderName } from '@shared/promptFolderName'
import {
  mutatePacedRevisionUpdateTransaction,
  runRevisionMutation
} from '../IpcFramework/RevisionCollections'
import { promptFolderDraftCollection } from '../Collections/PromptFolderDraftCollection'
import { promptFolderCollection } from '../Collections/PromptFolderCollection'
import { getLatestMutationModifiedRecord } from '../IpcFramework/RevisionMutationLookup'
import { ipcInvokeWithPayload } from '../IpcFramework/IpcRequestInvoke'
import { workspaceCollection } from '../Collections/WorkspaceCollection'

const readLatestPromptFolderFromTransaction = (
  transaction: Transaction<any>,
  promptFolderId: string
): PromptFolder => {
  return getLatestMutationModifiedRecord(
    transaction,
    promptFolderCollection.id,
    promptFolderId,
    () => promptFolderCollection.get(promptFolderId)!
  )
}

type PacedPromptFolderMutationOptions = Parameters<
  typeof mutatePacedRevisionUpdateTransaction<PromptFolderRevisionResponsePayload>
>[0]

type PacedPromptFolderSettingsAutosaveUpdateOptions = Pick<
  PacedPromptFolderMutationOptions,
  'debounceMs' | 'mutateOptimistically'
> & {
  promptFolderId: string
}

export const mutatePacedPromptFolderSettingsAutosaveUpdate = ({
  promptFolderId,
  debounceMs,
  mutateOptimistically
}: PacedPromptFolderSettingsAutosaveUpdateOptions): void => {
  mutatePacedRevisionUpdateTransaction<PromptFolderRevisionResponsePayload>({
    collectionId: promptFolderCollection.id,
    elementId: promptFolderId,
    debounceMs,
    mutateOptimistically,
    persistMutations: async ({ transaction }) => {
      const latestPromptFolder = readLatestPromptFolderFromTransaction(transaction, promptFolderId)

      const mutationResult = await ipcInvokeWithPayload<
        IpcMutationPayloadResult<PromptFolderRevisionResponsePayload>,
        UpdatePromptFolderSettingsPayload
      >('update-prompt-folder-settings', {
        promptFolder: {
          id: promptFolderId,
          expectedRevision: promptFolderCollection.utils.getAuthoritativeRevision(promptFolderId),
          data: copyPromptFolderSettings(latestPromptFolder.settings)
        }
      })

      if (mutationResult.success) {
        promptFolderDraftCollection.utils.acceptMutations(transaction)
      }

      return mutationResult
    },
    handleSuccessOrConflictResponse: (payload) => {
      promptFolderCollection.utils.upsertAuthoritative(payload.promptFolder)
    },
    conflictMessage: 'Prompt folder settings update conflict'
  })
}

export const createPromptFolder = async (
  workspaceId: string,
  displayName: string
): Promise<void> => {
  const workspace = workspaceCollection.get(workspaceId)

  if (!workspace) {
    throw new Error('Workspace not loaded')
  }

  const { displayName: normalizedDisplayName, folderName } = preparePromptFolderName(displayName)
  const optimisticPromptFolderId = compactGuid(crypto.randomUUID())

  await runRevisionMutation<CreatePromptFolderResponsePayload>({
    mutateOptimistically: ({ collections }) => {
      collections.promptFolder.insert({
        id: optimisticPromptFolderId,
        folderName,
        displayName: normalizedDisplayName,
        promptCount: 0,
        promptIds: [],
        completedPromptIds: [],
        settings: createEmptyPromptFolderSettings()
      })
      collections.promptFolderDraft.insert({
        id: optimisticPromptFolderId,
        settings: createEmptyPromptFolderSettings(),
        hasLoadedInitialData: false
      })
      collections.workspace.update(workspaceId, (draft) => {
        draft.promptFolderIds = [optimisticPromptFolderId, ...draft.promptFolderIds]
      })
    },
    persistMutations: async ({ entities, invoke, transaction }) => {
      const mutationResult = await invoke<{ payload: CreatePromptFolderPayload }>(
        'create-prompt-folder',
        {
          payload: {
            workspace: entities.workspace({
              id: workspaceId,
              data: workspace
            }),
            promptFolderId: optimisticPromptFolderId,
            displayName: normalizedDisplayName
          }
        }
      )

      if (mutationResult.success) {
        promptFolderDraftCollection.utils.acceptMutations(transaction)
      }

      return mutationResult
    },
    handleSuccessOrConflictResponse: (payload) => {
      workspaceCollection.utils.upsertAuthoritative(payload.workspace)

      if (!payload.promptFolder) {
        return
      }

      promptFolderCollection.utils.upsertAuthoritative(payload.promptFolder)
    },
    conflictMessage: 'Prompt folder create conflict'
  })
}
