import {
  UPDATE_PROMPT_UI_STATE_CHANNEL,
  type PromptUiState,
  type PromptUiStateRevisionPayload,
  type PromptUiStateRevisionResponsePayload
} from '@shared/PromptUiState'
import type { Transaction } from '@tanstack/svelte-db'
import { promptUiStateCollection } from '../Collections/PromptUiStateCollection'
import { promptUiStateDraftCollection } from '../Collections/PromptUiStateDraftCollection'
import { getLatestMutationModifiedRecord } from '../IpcFramework/RevisionMutationLookup'
import { mutatePacedRevisionUpdateTransaction } from '../IpcFramework/RevisionCollections'

const readLatestPromptUiStateFromTransaction = (
  transaction: Transaction<any>,
  promptId: string
): PromptUiState => {
  return getLatestMutationModifiedRecord(
    transaction,
    promptUiStateCollection.id,
    promptId,
    () => promptUiStateCollection.get(promptId)!
  )
}

type PacedPromptUiStateMutationOptions = Parameters<
  typeof mutatePacedRevisionUpdateTransaction<PromptUiStateRevisionResponsePayload>
>[0]

type PacedPromptUiStateAutosaveUpdateOptions = Pick<
  PacedPromptUiStateMutationOptions,
  'debounceMs' | 'mutateOptimistically'
> & {
  promptId: string
}

export const mutatePacedPromptUiStateAutosaveUpdate = ({
  promptId,
  debounceMs,
  mutateOptimistically
}: PacedPromptUiStateAutosaveUpdateOptions): void => {
  mutatePacedRevisionUpdateTransaction<PromptUiStateRevisionResponsePayload>({
    collectionId: promptUiStateCollection.id,
    elementId: promptId,
    debounceMs,
    mutateOptimistically,
    persistMutations: async ({ entities, invoke, transaction }) => {
      const latestPromptUiState = readLatestPromptUiStateFromTransaction(transaction, promptId)

      const mutationResult = await invoke<{ payload: PromptUiStateRevisionPayload }>(
        UPDATE_PROMPT_UI_STATE_CHANNEL,
        {
          payload: {
            promptUiState: entities.promptUiState({
              id: promptId,
              data: latestPromptUiState
            })
          }
        }
      )

      if (mutationResult.success) {
        promptUiStateDraftCollection.utils.acceptMutations(transaction)
      }

      return mutationResult
    },
    handleSuccessOrConflictResponse: (payload) => {
      promptUiStateCollection.utils.upsertAuthoritative(payload.promptUiState)
      const existingDraft = promptUiStateDraftCollection.get(payload.promptUiState.id)

      if (existingDraft) {
        promptUiStateDraftCollection.update(payload.promptUiState.id, (draft) => {
          draft.workspaceId = payload.promptUiState.data.workspaceId
          draft.promptId = payload.promptUiState.data.promptId
          draft.editorViewStateJson = payload.promptUiState.data.editorViewStateJson
        })
      } else {
        promptUiStateDraftCollection.insert(payload.promptUiState.data)
      }
    },
    conflictMessage: 'Prompt ui state update conflict'
  })
}
