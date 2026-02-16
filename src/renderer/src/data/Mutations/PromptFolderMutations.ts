import type {
  CreatePromptFolderPayload,
  CreatePromptFolderResponsePayload,
  PromptFolder,
  PromptFolderRevisionPayload,
  PromptFolderRevisionResponsePayload
} from '@shared/PromptFolder'
import type { Transaction } from '@tanstack/svelte-db'
import { preparePromptFolderName } from '@shared/promptFolderName'
import {
  mutatePacedRevisionUpdateTransaction,
  runRevisionMutation
} from '../IpcFramework/RevisionCollections'
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

const upsertPromptFolderDraftSnapshot = (promptFolder: PromptFolder): void => {
  const existingDraft = promptFolderDraftCollection.get(promptFolder.id)
  if (!existingDraft) {
    promptFolderDraftCollection.insert({
      id: promptFolder.id,
      draftSnapshot: {
        folderDescription: promptFolder.folderDescription
      },
      saveError: null,
      descriptionMeasuredHeightsByKey: {}
    })
    return
  }

  promptFolderDraftCollection.update(promptFolder.id, (draftRecord) => {
    draftRecord.draftSnapshot.folderDescription = promptFolder.folderDescription
    draftRecord.saveError = null
  })
}

type PacedPromptFolderMutationOptions = Parameters<
  typeof mutatePacedRevisionUpdateTransaction<PromptFolderRevisionResponsePayload>
>[0]

type PacedPromptFolderAutosaveUpdateOptions = Pick<
  PacedPromptFolderMutationOptions,
  'debounceMs' | 'mutateOptimistically' | 'draftOnlyChange'
> & {
  promptFolderId: string
}

export const mutatePacedPromptFolderAutosaveUpdate = ({
  promptFolderId,
  debounceMs,
  mutateOptimistically,
  draftOnlyChange
}: PacedPromptFolderAutosaveUpdateOptions): boolean => {
  return mutatePacedRevisionUpdateTransaction<PromptFolderRevisionResponsePayload>({
    collectionId: promptFolderCollection.id,
    elementId: promptFolderId,
    debounceMs,
    mutateOptimistically,
    draftOnlyChange,
    persistMutations: async ({ entities, invoke, transaction }) => {
      const latestPromptFolder = readLatestPromptFolderFromTransaction(
        transaction,
        promptFolderId
      )

      try {
        const mutationResult = await invoke<{ payload: PromptFolderRevisionPayload }>(
          'update-prompt-folder',
          {
            payload: {
              promptFolder: entities.promptFolder({
                id: promptFolderId,
                data: latestPromptFolder
              })
            }
          }
        )

        if (!mutationResult.success) {
          console.error(
            'Failed to update prompt folder:',
            mutationResult.conflict ? 'Prompt folder update conflict' : mutationResult.error
          )
        }

        return mutationResult
      } catch (error) {
        console.error('Failed to update prompt folder:', error)
        throw error
      }
    },
    handleSuccessOrConflictResponse: (payload) => {
      promptFolderCollection.utils.upsertAuthoritative(payload.promptFolder)
      upsertPromptFolderDraftSnapshot(payload.promptFolder.data)
    },
    conflictMessage: 'Prompt folder update conflict'
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

  const {
    displayName: normalizedDisplayName,
    folderName
  } = preparePromptFolderName(displayName)
  const optimisticPromptFolderId = crypto.randomUUID()

  await runRevisionMutation<CreatePromptFolderResponsePayload>({
    mutateOptimistically: ({ collections }) => {
      collections.promptFolder.insert({
        id: optimisticPromptFolderId,
        folderName,
        displayName: normalizedDisplayName,
        promptCount: 0,
        promptIds: [],
        folderDescription: ''
      })
      collections.promptFolderDraft.insert({
        id: optimisticPromptFolderId,
        draftSnapshot: {
          folderDescription: ''
        },
        saveError: null,
        descriptionMeasuredHeightsByKey: {}
      })
      collections.workspace.update(workspaceId, (draft) => {
        draft.promptFolderIds = [...draft.promptFolderIds, optimisticPromptFolderId]
      })
    },
    persistMutations: async ({ entities, invoke }) => {
      return invoke<{ payload: CreatePromptFolderPayload }>('create-prompt-folder', {
        payload: {
          workspace: entities.workspace({
            id: workspaceId,
            data: workspace
          }),
          promptFolderId: optimisticPromptFolderId,
          displayName: normalizedDisplayName
        }
      })
    },
    handleSuccessOrConflictResponse: (payload) => {
      workspaceCollection.utils.upsertAuthoritative(payload.workspace)

      if (!payload.promptFolder) {
        return
      }

      promptFolderCollection.utils.upsertAuthoritative(payload.promptFolder)
      upsertPromptFolderDraftSnapshot(payload.promptFolder.data)
    },
    conflictMessage: 'Prompt folder create conflict'
  })
}

const updatePromptFolder = async (
  promptFolder: PromptFolder
): Promise<void> => {
  if (!promptFolderCollection.get(promptFolder.id)) {
    throw new Error('Prompt folder not loaded')
  }

  await runRevisionMutation<PromptFolderRevisionResponsePayload>({
    mutateOptimistically: ({ collections }) => {
      collections.promptFolder.update(promptFolder.id, (draft) => {
        draft.folderName = promptFolder.folderName
        draft.displayName = promptFolder.displayName
        draft.promptCount = promptFolder.promptCount
        draft.promptIds = [...promptFolder.promptIds]
        draft.folderDescription = promptFolder.folderDescription
      })
    },
    persistMutations: async ({ entities, invoke }) => {
      return invoke<{ payload: PromptFolderRevisionPayload }>('update-prompt-folder', {
        payload: {
          promptFolder: entities.promptFolder({
            id: promptFolder.id,
            data: promptFolder
          })
        }
      })
    },
    handleSuccessOrConflictResponse: (payload) => {
      promptFolderCollection.utils.upsertAuthoritative(payload.promptFolder)
      upsertPromptFolderDraftSnapshot(payload.promptFolder.data)
    },
    conflictMessage: 'Prompt folder update conflict'
  })
}

const requirePromptFolder = (promptFolderId: string): PromptFolder => {
  const promptFolder = promptFolderCollection.get(promptFolderId)

  if (!promptFolder) {
    throw new Error('Prompt folder not loaded')
  }

  return promptFolder
}

export const updatePromptFolderDescription = async (
  promptFolderId: string,
  folderDescription: string
): Promise<void> => {
  const promptFolder = requirePromptFolder(promptFolderId)

  await updatePromptFolder({
    ...promptFolder,
    promptIds: [...promptFolder.promptIds],
    folderDescription
  })
}

export const reorderPromptFolderPrompts = async (
  promptFolderId: string,
  promptIds: string[]
): Promise<void> => {
  const promptFolder = requirePromptFolder(promptFolderId)

  await updatePromptFolder({
    ...promptFolder,
    promptIds: [...promptIds]
  })
}
