import type { TanstackPrompt } from '@shared/tanstack/TanstackPrompt'
import type {
  TanstackCreatePromptRequest,
  TanstackCreatePromptResponsePayload,
  TanstackCreatePromptResult
} from '@shared/tanstack/TanstackPromptCreate'
import type {
  TanstackDeletePromptRequest,
  TanstackDeletePromptResponsePayload,
  TanstackDeletePromptResult
} from '@shared/tanstack/TanstackPromptDelete'
import type {
  TanstackPromptRevisionResponsePayload,
  TanstackUpdatePromptRevisionRequest,
  TanstackUpdatePromptRevisionResult
} from '@shared/tanstack/TanstackPromptRevision'
import { tanstackPromptCollection } from '../Collections/TanstackPromptCollection'
import { tanstackPromptFolderCollection } from '../Collections/TanstackPromptFolderCollection'
import { runTanstackRevisionMutation } from '../IpcFramework/TanstackRevisionCollections'

export const createTanstackPrompt = async (
  promptFolderId: string,
  prompt: TanstackPrompt,
  previousPromptId: string | null
): Promise<void> => {
  const promptFolder = tanstackPromptFolderCollection.get(promptFolderId)

  if (!promptFolder) {
    throw new Error('Prompt folder not loaded')
  }

  await runTanstackRevisionMutation<TanstackCreatePromptResponsePayload>({
    mutateOptimistically: () => {
      const optimisticPromptCount = promptFolder.promptCount + 1

      tanstackPromptCollection.insert({
        ...prompt,
        promptFolderCount: optimisticPromptCount
      })

      tanstackPromptFolderCollection.update(promptFolderId, (draft) => {
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
    runMutation: async ({ entities, invoke }) => {
      return invoke<TanstackCreatePromptResult, TanstackCreatePromptRequest>(
        'tanstack-create-prompt',
        {
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
        }
      )
    },
    handleSuccessOrConflictResponse: (payload) => {
      tanstackPromptFolderCollection.utils.upsertAuthoritative(payload.promptFolder)

      if (!payload.prompt) {
        return
      }

      tanstackPromptCollection.utils.upsertAuthoritative(payload.prompt)
    },
    conflictMessage: 'Prompt create conflict'
  })
}

export const updateTanstackPrompt = async (prompt: TanstackPrompt): Promise<void> => {
  if (!tanstackPromptCollection.get(prompt.id)) {
    throw new Error('Prompt not loaded')
  }

  await runTanstackRevisionMutation<TanstackPromptRevisionResponsePayload>({
    mutateOptimistically: () => {
      tanstackPromptCollection.update(prompt.id, (draft) => {
        draft.title = prompt.title
        draft.creationDate = prompt.creationDate
        draft.lastModifiedDate = prompt.lastModifiedDate
        draft.promptText = prompt.promptText
        draft.promptFolderCount = prompt.promptFolderCount
      })
    },
    runMutation: async ({ entities, invoke }) => {
      return invoke<TanstackUpdatePromptRevisionResult, TanstackUpdatePromptRevisionRequest>(
        'tanstack-update-prompt',
        {
          payload: {
            prompt: entities.prompt({
              id: prompt.id,
              data: prompt
            })
          }
        }
      )
    },
    handleSuccessOrConflictResponse: (payload) => {
      tanstackPromptCollection.utils.upsertAuthoritative(payload.prompt)
    },
    conflictMessage: 'Prompt update conflict'
  })
}

export const deleteTanstackPrompt = async (
  promptFolderId: string,
  promptId: string
): Promise<void> => {
  const promptFolder = tanstackPromptFolderCollection.get(promptFolderId)
  if (!promptFolder) {
    throw new Error('Prompt folder not loaded')
  }

  const prompt = tanstackPromptCollection.get(promptId)
  if (!prompt) {
    throw new Error('Prompt not loaded')
  }

  await runTanstackRevisionMutation<TanstackDeletePromptResponsePayload>({
    mutateOptimistically: () => {
      tanstackPromptCollection.delete(promptId)
      tanstackPromptFolderCollection.update(promptFolderId, (draft) => {
        draft.promptIds = draft.promptIds.filter((id) => id !== promptId)
      })
    },
    runMutation: async ({ entities, invoke }) => {
      return invoke<TanstackDeletePromptResult, TanstackDeletePromptRequest>(
        'tanstack-delete-prompt',
        {
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
        }
      )
    },
    handleSuccessOrConflictResponse: (payload) => {
      tanstackPromptFolderCollection.utils.upsertAuthoritative(payload.promptFolder)
    },
    conflictMessage: 'Prompt delete conflict',
    onSuccess: () => {
      // Side effect: clear the prompt revision cache after the delete commit succeeds.
      tanstackPromptCollection.utils.deleteAuthoritative(promptId)
    }
  })
}
