import {
  createPromptFull,
  isPromptFull,
  type CreatePromptPayload,
  type CreatePromptResponsePayload,
  type DeletePromptPayload,
  type DeletePromptResponsePayload,
  type Prompt,
  type PromptFull,
  type PromptPersisted,
  type PromptRevisionResponsePayload,
  type PromptRevisionPayload
} from '@shared/Prompt'
import type { IpcMutationPayloadResult } from '@shared/IpcResult'
import type { Transaction } from '@tanstack/svelte-db'
import { promptDraftCollection } from '../Collections/PromptDraftCollection'
import { promptCollection } from '../Collections/PromptCollection'
import { promptFolderCollection } from '../Collections/PromptFolderCollection'
import { ipcInvokeWithPayload } from '../IpcFramework/IpcRequestInvoke'
import { getLatestMutationModifiedRecord } from '../IpcFramework/RevisionMutationLookup'
import {
  mutatePacedRevisionUpdateTransaction,
  runRevisionMutation
} from '../IpcFramework/RevisionCollections'

const toPersistedPrompt = (prompt: Prompt): PromptPersisted => {
  if (!isPromptFull(prompt)) {
    throw new Error('Prompt not fully loaded')
  }

  return {
    id: prompt.id,
    title: prompt.title,
    creationDate: prompt.creationDate,
    lastModifiedDate: prompt.lastModifiedDate,
    promptText: prompt.promptText,
    promptFolderCount: prompt.promptFolderCount
  }
}

const toFullPromptSnapshot = (snapshot: {
  id: string
  revision: number
  data: PromptPersisted
}) => {
  return {
    ...snapshot,
    data: createPromptFull(snapshot.data)
  }
}

const readLatestPromptFromTransaction = (
  transaction: Transaction<any>,
  promptId: string
): PromptPersisted => {
  const prompt = getLatestMutationModifiedRecord(
    transaction,
    promptCollection.id,
    promptId,
    () => promptCollection.get(promptId)!
  )

  return toPersistedPrompt(prompt)
}

export const createPrompt = async (
  promptFolderId: string,
  prompt: PromptFull,
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
      collections.promptDraft.insert(optimisticPrompt)

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
    persistMutations: async ({ entities, transaction }) => {
      const promptEntity = entities.prompt({
        id: prompt.id,
        data: prompt
      })
      const mutationResult = await ipcInvokeWithPayload<
        IpcMutationPayloadResult<CreatePromptResponsePayload>,
        CreatePromptPayload
      >('create-prompt', {
        promptFolder: entities.promptFolder({
          id: promptFolderId,
          data: promptFolder
        }),
        prompt: {
          ...promptEntity,
          data: toPersistedPrompt(promptEntity.data)
        },
        previousPromptId
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

      promptCollection.utils.upsertAuthoritative(toFullPromptSnapshot(payload.prompt))
    },
    conflictMessage: 'Prompt create conflict'
  })
}

type PacedPromptMutationOptions = Parameters<
  typeof mutatePacedRevisionUpdateTransaction<PromptRevisionResponsePayload>
>[0]

type PacedPromptAutosaveUpdateOptions = Pick<
  PacedPromptMutationOptions,
  'debounceMs' | 'mutateOptimistically'
> & {
  promptId: string
}

export const mutatePacedPromptAutosaveUpdate = ({
  promptId,
  debounceMs,
  mutateOptimistically
}: PacedPromptAutosaveUpdateOptions): void => {
  mutatePacedRevisionUpdateTransaction<PromptRevisionResponsePayload>({
    collectionId: promptCollection.id,
    elementId: promptId,
    debounceMs,
    mutateOptimistically,
    persistMutations: async ({ entities, transaction }) => {
      const latestPrompt = readLatestPromptFromTransaction(transaction, promptId)
      const promptEntity = entities.prompt({
        id: promptId,
        data: createPromptFull(latestPrompt)
      })
      const mutationResult = await ipcInvokeWithPayload<
        IpcMutationPayloadResult<PromptRevisionResponsePayload>,
        PromptRevisionPayload
      >('update-prompt', {
        prompt: {
          ...promptEntity,
          data: toPersistedPrompt(promptEntity.data)
        }
      })

      if (mutationResult.success) {
        promptDraftCollection.utils.acceptMutations(transaction)
      }

      return mutationResult
    },
    handleSuccessOrConflictResponse: (payload) => {
      promptCollection.utils.upsertAuthoritative(toFullPromptSnapshot(payload.prompt))
    },
    conflictMessage: 'Prompt update conflict'
  })
}

export const deletePrompt = async (promptFolderId: string, promptId: string): Promise<void> => {
  const promptFolder = promptFolderCollection.get(promptFolderId)
  if (!promptFolder) {
    throw new Error('Prompt folder not loaded')
  }

  const prompt = promptCollection.get(promptId)
  if (!prompt) {
    throw new Error('Prompt not loaded')
  }

  const persistedPrompt = toPersistedPrompt(prompt)

  await runRevisionMutation<DeletePromptResponsePayload>({
    mutateOptimistically: ({ collections }) => {
      collections.prompt.delete(promptId)
      collections.promptDraft.delete(promptId)
      collections.promptFolder.update(promptFolderId, (draft) => {
        draft.promptIds = draft.promptIds.filter((id) => id !== promptId)
      })
    },
    persistMutations: async ({ entities, transaction }) => {
      const promptEntity = entities.prompt({
        id: promptId,
        data: createPromptFull(persistedPrompt)
      })
      const mutationResult = await ipcInvokeWithPayload<
        IpcMutationPayloadResult<DeletePromptResponsePayload>,
        DeletePromptPayload
      >('delete-prompt', {
        promptFolder: entities.promptFolder({
          id: promptFolderId,
          data: promptFolder
        }),
        prompt: {
          ...promptEntity,
          data: toPersistedPrompt(promptEntity.data)
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
