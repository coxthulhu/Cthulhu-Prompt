import {
  copyPromptFolderSettings,
  createEmptyPromptFolderSettings,
  type CreatePromptFolderPayload,
  type CreatePromptFolderResponsePayload,
  type PromptFolder,
  type PromptFolderRevisionResponsePayload,
  type RenamePromptFolderPayload,
  type UpdatePromptFolderSettingsPayload
} from '@shared/PromptFolder'
import type { IpcMutationPayloadResult } from '@shared/IpcResult'
import { compactGuid } from '@shared/compactGuid'
import type { Transaction } from '@tanstack/svelte-db'
import { preparePromptFolderName } from '@shared/promptFolderName'
import { folderEntryRef } from '@shared/OrderContainer'
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
  displayName: string,
  parentPromptFolderId: string | null = null,
  previousEntryId: string | null = null
): Promise<string> => {
  const workspace = workspaceCollection.get(workspaceId)

  if (!workspace) {
    throw new Error('Workspace not loaded')
  }

  const parentPromptFolder = parentPromptFolderId
    ? promptFolderCollection.get(parentPromptFolderId)
    : null

  if (parentPromptFolderId && !parentPromptFolder) {
    throw new Error('Parent prompt folder not loaded')
  }

  const { displayName: normalizedDisplayName, folderName } = preparePromptFolderName(displayName)
  const optimisticPromptFolderId = compactGuid(crypto.randomUUID())

  await runRevisionMutation<CreatePromptFolderResponsePayload>({
    mutateOptimistically: ({ collections }) => {
      collections.promptFolder.insert({
        id: optimisticPromptFolderId,
        folderName,
        displayName: normalizedDisplayName,
        entries: [],
        completedPromptIds: [],
        settings: createEmptyPromptFolderSettings()
      })
      collections.promptFolderDraft.insert({
        id: optimisticPromptFolderId,
        settings: createEmptyPromptFolderSettings(),
        hasLoadedInitialData: false
      })
      if (parentPromptFolderId) {
        collections.promptFolder.update(parentPromptFolderId, (draft) => {
          const insertIndex =
            previousEntryId === null
              ? 0
              : draft.entries.findIndex((entry) => entry.id === previousEntryId) + 1
          const entries = [...draft.entries]
          entries.splice(insertIndex, 0, folderEntryRef(optimisticPromptFolderId))
          draft.entries = entries
        })
      } else {
        collections.workspace.update(workspaceId, (draft) => {
          const insertIndex =
            previousEntryId === null
              ? 0
              : draft.entries.findIndex((entry) => entry.id === previousEntryId) + 1
          const entries = [...draft.entries]
          entries.splice(insertIndex, 0, folderEntryRef(optimisticPromptFolderId))
          draft.entries = entries
        })
      }
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
            parentPromptFolder: parentPromptFolderId
              ? entities.promptFolder({
                  id: parentPromptFolderId,
                  data: parentPromptFolder!
                })
              : null,
            promptFolderId: optimisticPromptFolderId,
            displayName: normalizedDisplayName,
            previousEntryId
          }
        }
      )

      if (mutationResult.success) {
        promptFolderDraftCollection.utils.acceptMutations(transaction)
      }

      return mutationResult
    },
    handleSuccessOrConflictResponse: (payload) => {
      if (payload.workspace) {
        workspaceCollection.utils.upsertAuthoritative(payload.workspace)
      }

      if (payload.parentPromptFolder) {
        promptFolderCollection.utils.upsertAuthoritative(payload.parentPromptFolder)
      }

      if (!payload.promptFolder) {
        return
      }

      promptFolderCollection.utils.upsertAuthoritative(payload.promptFolder)
    },
    conflictMessage: 'Prompt folder create conflict'
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

  const { displayName: normalizedDisplayName, folderName } = preparePromptFolderName(displayName)

  await runRevisionMutation<PromptFolderRevisionResponsePayload>({
    mutateOptimistically: ({ collections }) => {
      collections.promptFolder.update(promptFolderId, (draft) => {
        draft.displayName = normalizedDisplayName
        draft.folderName = folderName
      })
    },
    persistMutations: async ({ entities, invoke, transaction }) => {
      const latestPromptFolder = readLatestPromptFolderFromTransaction(transaction, promptFolderId)

      return await invoke<{ payload: RenamePromptFolderPayload }>('rename-prompt-folder', {
        payload: {
          promptFolder: entities.promptFolder({
            id: promptFolderId,
            data: latestPromptFolder
          }),
          displayName: normalizedDisplayName
        }
      })
    },
    handleSuccessOrConflictResponse: (payload) => {
      promptFolderCollection.utils.upsertAuthoritative(payload.promptFolder)
    },
    conflictMessage: 'Prompt folder rename conflict'
  })
}
