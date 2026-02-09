import type { TanstackPrompt } from '@shared/tanstack/TanstackPrompt'
import type {
  TanstackCreatePromptRequest,
  TanstackCreatePromptResponsePayload,
  TanstackCreatePromptResult
} from '@shared/tanstack/TanstackPromptCreate'
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
