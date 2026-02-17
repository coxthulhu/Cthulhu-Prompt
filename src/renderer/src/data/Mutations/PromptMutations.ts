import type {
  CreatePromptPayload,
  CreatePromptResponsePayload,
  DeletePromptResponsePayload,
  Prompt,
  PromptRevisionResponsePayload,
  PromptRevisionPayload
} from '@shared/Prompt'
import type { Transaction } from '@tanstack/svelte-db'
import { promptDraftCollection } from '../Collections/PromptDraftCollection'
import { promptCollection } from '../Collections/PromptCollection'
import { promptFolderCollection } from '../Collections/PromptFolderCollection'
import { getLatestMutationModifiedRecord } from '../IpcFramework/RevisionMutationLookup'
import {
  mutatePacedRevisionUpdateTransaction,
  runRevisionMutation
} from '../IpcFramework/RevisionCollections'

const readLatestPromptFromTransaction = (
  transaction: Transaction<any>,
  promptId: string
): Prompt => {
  return getLatestMutationModifiedRecord(
    transaction,
    promptCollection.id,
    promptId,
    () => promptCollection.get(promptId)!
  )
}

export const createPrompt = async (
  promptFolderId: string,
  prompt: Prompt,
  previousPromptId: string | null
): Promise<void> => {
  const promptFolder = promptFolderCollection.get(promptFolderId)

  if (!promptFolder) {
    throw new Error('Prompt folder not loaded')
  }

  await runRevisionMutation<CreatePromptResponsePayload>({
    mutateOptimistically: ({ collections }) => {
      const optimisticPromptCount = promptFolder.promptCount + 1
      const optimisticPrompt = {
        ...prompt,
        promptFolderCount: optimisticPromptCount
      }

      collections.prompt.insert(optimisticPrompt)
      collections.promptDraft.insert({
        ...optimisticPrompt,
        promptEditorMeasuredHeightsByKey: {}
      })

      collections.promptFolder.update(promptFolderId, (draft) => {
        let insertIndex = draft.promptIds.length

        if (previousPromptId === null) {
          insertIndex = 0
        } else {
          const previousIndex = draft.promptIds.indexOf(previousPromptId)
          if (previousIndex !== -1) {
            insertIndex = previousIndex + 1
          }
        }

        const nextPromptIds = [...draft.promptIds]
        nextPromptIds.splice(insertIndex, 0, prompt.id)
        draft.promptIds = nextPromptIds
        draft.promptCount += 1
      })
    },
    persistMutations: async ({ entities, invoke, transaction }) => {
      const mutationResult = await invoke<{ payload: CreatePromptPayload }>('create-prompt', {
        payload: {
          promptFolder: entities.promptFolder({
            id: promptFolderId,
            data: promptFolder
          }),
          prompt: entities.prompt({
            id: prompt.id,
            data: prompt
          }),
          previousPromptId
        }
      })

      if (mutationResult.success) {
        promptDraftCollection.utils.acceptMutations(transaction)
      }

      return mutationResult
    },
    handleSuccessOrConflictResponse: (payload) => {
      promptFolderCollection.utils.upsertAuthoritative(payload.promptFolder)

      if (!payload.prompt) {
        return
      }

      promptCollection.utils.upsertAuthoritative(payload.prompt)
    },
    conflictMessage: 'Prompt create conflict'
  })
}

type PacedPromptMutationOptions = Parameters<
  typeof mutatePacedRevisionUpdateTransaction<PromptRevisionResponsePayload>
>[0]

type PacedPromptAutosaveUpdateOptions = Pick<
  PacedPromptMutationOptions,
  'debounceMs' | 'mutateOptimistically' | 'draftOnlyChange'
> & {
  promptId: string
}

export const mutatePacedPromptAutosaveUpdate = ({
  promptId,
  debounceMs,
  mutateOptimistically,
  draftOnlyChange
}: PacedPromptAutosaveUpdateOptions): boolean => {
  return mutatePacedRevisionUpdateTransaction<PromptRevisionResponsePayload>({
    collectionId: promptCollection.id,
    elementId: promptId,
    debounceMs,
    mutateOptimistically,
    draftOnlyChange,
    persistMutations: async ({ entities, invoke, transaction }) => {
      const latestPrompt = readLatestPromptFromTransaction(transaction, promptId)
      const mutationResult = await invoke<{ payload: PromptRevisionPayload }>('update-prompt', {
        payload: {
          prompt: entities.prompt({
            id: promptId,
            data: latestPrompt
          })
        }
      })

      if (mutationResult.success) {
        promptDraftCollection.utils.acceptMutations(transaction)
      }

      return mutationResult
    },
    handleSuccessOrConflictResponse: (payload) => {
      promptCollection.utils.upsertAuthoritative(payload.prompt)
    },
    conflictMessage: 'Prompt update conflict'
  })
}

export const deletePrompt = async (
  promptFolderId: string,
  promptId: string
): Promise<void> => {
  const promptFolder = promptFolderCollection.get(promptFolderId)
  if (!promptFolder) {
    throw new Error('Prompt folder not loaded')
  }

  const prompt = promptCollection.get(promptId)
  if (!prompt) {
    throw new Error('Prompt not loaded')
  }

  await runRevisionMutation<DeletePromptResponsePayload>({
    mutateOptimistically: ({ collections }) => {
      collections.prompt.delete(promptId)
      collections.promptDraft.delete(promptId)
      collections.promptFolder.update(promptFolderId, (draft) => {
        draft.promptIds = draft.promptIds.filter((id) => id !== promptId)
      })
    },
    persistMutations: async ({ entities, invoke, transaction }) => {
      const mutationResult = await invoke('delete-prompt', {
        payload: {
          promptFolder: entities.promptFolder({
            id: promptFolderId,
            data: promptFolder
          }),
          prompt: entities.prompt({
            id: promptId,
            data: prompt
          })
        }
      })

      if (mutationResult.success) {
        promptDraftCollection.utils.acceptMutations(transaction)
      }

      return mutationResult
    },
    handleSuccessOrConflictResponse: (payload) => {
      promptFolderCollection.utils.upsertAuthoritative(payload.promptFolder)
    },
    conflictMessage: 'Prompt delete conflict',
    onSuccess: () => {
      // Side effect: clear the prompt revision cache after the delete commit succeeds.
      promptCollection.utils.deleteAuthoritative(promptId)
    }
  })
}
