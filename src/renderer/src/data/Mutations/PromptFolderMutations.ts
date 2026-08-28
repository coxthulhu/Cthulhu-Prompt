import {
  createEmptyPromptFolderSettings,
  createRootCategoryOrder,
  type CreatePromptFolderPayload,
  type CreatePromptFolderResponsePayload,
  type PromptFolder,
  type PromptFolderKind,
  type PromptFolderRevisionResponsePayload,
  type RenamePromptFolderPayload
} from '@shared/PromptFolder'
import { compactGuid } from '@shared/compactGuid'
import type { Transaction } from '@tanstack/svelte-db'
import { preparePromptFolderName } from '@shared/promptFolderName'
import { folderEntryRef, resolveEntryInsertIndex } from '@shared/OrderContainer'
import { runRevisionMutation } from '../IpcFramework/RevisionCollections'
import { promptFolderDraftCollection } from '../Collections/PromptFolderDraftCollection'
import { promptFolderCollection } from '../Collections/PromptFolderCollection'
import { getLatestMutationModifiedRecord } from '../IpcFramework/RevisionMutationLookup'
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

  const { displayName: normalizedDisplayName, folderName } = preparePromptFolderName(displayName)
  const optimisticPromptFolderId = compactGuid(crypto.randomUUID())
  const optimisticPromptFolder: PromptFolder = {
    id: optimisticPromptFolderId,
    kind,
    folderName,
    displayName: normalizedDisplayName,
    completedPromptIds: [],
    categoryOrder: createRootCategoryOrder(),
    settings: createEmptyPromptFolderSettings()
  } as PromptFolder

  await runRevisionMutation<CreatePromptFolderResponsePayload>({
    mutateOptimistically: ({ collections }) => {
      collections.promptFolder.insert(optimisticPromptFolder)
      collections.promptFolderDraft.insert({
        id: optimisticPromptFolderId,
        hasLoadedInitialData: false
      })
      collections.workspace.update(workspaceId, (draft) => {
        const insertIndex = resolveEntryInsertIndex(draft.entries, previousEntryId)!
        const entries = [...draft.entries]
        entries.splice(insertIndex, 0, folderEntryRef(optimisticPromptFolderId))
        draft.entries = entries
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
            kind,
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
