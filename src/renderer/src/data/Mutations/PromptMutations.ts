import type {
  CreatePromptPayload,
  CreatePromptResponsePayload,
  DeletePromptResponsePayload,
  Prompt,
  PromptRevisionResponsePayload,
} from '@shared/Prompt'
import { promptCollection } from '../Collections/PromptCollection'
import { promptFolderCollection } from '../Collections/PromptFolderCollection'
import { runRevisionMutation } from '../IpcFramework/RevisionCollections'

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
    mutateOptimistically: () => {
      const optimisticPromptCount = promptFolder.promptCount + 1

      promptCollection.insert({
        ...prompt,
        promptFolderCount: optimisticPromptCount
      })

      promptFolderCollection.update(promptFolderId, (draft) => {
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
    persistMutations: async ({ entities, invoke }) => {
      return invoke<{ payload: CreatePromptPayload }>('create-prompt', {
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

export const updatePrompt = async (prompt: Prompt): Promise<void> => {
  if (!promptCollection.get(prompt.id)) {
    throw new Error('Prompt not loaded')
  }

  await runRevisionMutation<PromptRevisionResponsePayload>({
    mutateOptimistically: () => {
      promptCollection.update(prompt.id, (draft) => {
        draft.title = prompt.title
        draft.creationDate = prompt.creationDate
        draft.lastModifiedDate = prompt.lastModifiedDate
        draft.promptText = prompt.promptText
        draft.promptFolderCount = prompt.promptFolderCount
      })
    },
    persistMutations: async ({ entities, invoke }) => {
      return invoke('update-prompt', {
        payload: {
          prompt: entities.prompt({
            id: prompt.id,
            data: prompt
          })
        }
      })
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
    mutateOptimistically: () => {
      promptCollection.delete(promptId)
      promptFolderCollection.update(promptFolderId, (draft) => {
        draft.promptIds = draft.promptIds.filter((id) => id !== promptId)
      })
    },
    persistMutations: async ({ entities, invoke }) => {
      return invoke('delete-prompt', {
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
