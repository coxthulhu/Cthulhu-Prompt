import { ipcMain } from 'electron'
import {
  UPDATE_PROMPT_UI_STATE_CHANNEL,
  type PromptUiStateRevisionResponsePayload
} from '@shared/PromptUiState'
import {
  createPromptUiStateRevisionKey,
  PromptUiStateDataAccess
} from '../DataAccess/PromptUiStateDataAccess'
import { parseUpdatePromptUiStateRevisionRequest } from '../IpcFramework/IpcValidation'
import { runMutationIpcRequest } from '../IpcFramework/IpcRequest'
import { revisions } from '../Registries/Revisions'

const buildPromptUiStateRevisionPayload = (
  promptId: string,
  data: PromptUiStateRevisionResponsePayload['promptUiState']['data'],
  revision: number
): PromptUiStateRevisionResponsePayload['promptUiState'] => ({
  id: promptId,
  revision,
  data
})

export const setupPromptUiStateMutationHandlers = (): void => {
  ipcMain.handle(UPDATE_PROMPT_UI_STATE_CHANNEL, async (_, request: unknown) => {
    return await runMutationIpcRequest(
      request,
      parseUpdatePromptUiStateRevisionRequest,
      async (validatedRequest) => {
        try {
          const promptUiStateEntity = validatedRequest.payload.promptUiState
          const promptId = promptUiStateEntity.id
          const nextPromptUiState = {
            ...promptUiStateEntity.data,
            promptId
          }
          const revisionKey = createPromptUiStateRevisionKey(
            nextPromptUiState.workspaceId,
            promptId
          )
          const currentRevision = revisions.promptUiState.get(revisionKey)

          if (promptUiStateEntity.expectedRevision !== currentRevision) {
            const promptUiState = PromptUiStateDataAccess.readPromptUiState(
              nextPromptUiState.workspaceId,
              promptId
            )
            return {
              success: false,
              conflict: true,
              payload: {
                promptUiState: buildPromptUiStateRevisionPayload(
                  promptId,
                  promptUiState ?? nextPromptUiState,
                  currentRevision
                )
              }
            }
          }

          const promptUiState = PromptUiStateDataAccess.upsertPromptUiState(nextPromptUiState)
          const revision = revisions.promptUiState.bump(revisionKey)

          return {
            success: true,
            payload: {
              promptUiState: buildPromptUiStateRevisionPayload(promptId, promptUiState, revision)
            }
          }
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error)
          return {
            success: false,
            error: message || 'Failed to update prompt ui state'
          }
        }
      }
    )
  })
}
