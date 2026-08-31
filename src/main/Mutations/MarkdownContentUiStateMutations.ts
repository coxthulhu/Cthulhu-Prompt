import { ipcMain } from 'electron'
import {
  createMarkdownContentUiStateKey,
  UPDATE_MARKDOWN_CONTENT_UI_STATE_CHANNEL,
  type MarkdownContentUiStateRevisionResponsePayload
} from '@shared/MarkdownContentUiState'
import { MarkdownContentUiStateDataAccess } from '../DataAccess/MarkdownContentUiStateDataAccess'
import { parseUpdateMarkdownContentUiStateRevisionRequest } from '../IpcFramework/IpcValidation'
import { runMutationIpcRequest } from '../IpcFramework/IpcRequest'
import { revisions } from '../Registries/Revisions'

const buildRevisionPayload = (
  uiStateId: string,
  data: MarkdownContentUiStateRevisionResponsePayload['markdownContentUiState']['data'],
  revision: number
): MarkdownContentUiStateRevisionResponsePayload['markdownContentUiState'] => ({
  id: uiStateId,
  revision,
  data
})

export const setupMarkdownContentUiStateMutationHandlers = (): void => {
  ipcMain.handle(UPDATE_MARKDOWN_CONTENT_UI_STATE_CHANNEL, async (_, request: unknown) => {
    return await runMutationIpcRequest(
      request,
      parseUpdateMarkdownContentUiStateRevisionRequest,
      async (validatedRequest) => {
        try {
          const entity = validatedRequest.payload.markdownContentUiState
          /** Composite authoritative ID derived from the validated UI-state data. */
          const uiStateId = createMarkdownContentUiStateKey(
            entity.data.workspaceId,
            entity.data.contentId
          )
          if (entity.id !== uiStateId) {
            throw new Error('Markdown content UI-state ID does not match its data')
          }
          /** Authoritative UI-state data persisted without replacing either key component. */
          const nextUiState = entity.data
          const currentRevision = revisions.markdownContentUiState.get(uiStateId)

          if (entity.expectedRevision !== currentRevision) {
            const currentUiState =
              MarkdownContentUiStateDataAccess.readMarkdownContentUiState(
                nextUiState.workspaceId,
                nextUiState.contentId
              )
            return {
              success: false,
              conflict: true,
              payload: {
                markdownContentUiState: buildRevisionPayload(
                  uiStateId,
                  currentUiState ?? nextUiState,
                  currentRevision
                )
              }
            }
          }

          const uiState = MarkdownContentUiStateDataAccess.upsertMarkdownContentUiState(nextUiState)
          const revision = revisions.markdownContentUiState.bump(uiStateId)
          return {
            success: true,
            payload: {
              markdownContentUiState: buildRevisionPayload(uiStateId, uiState, revision)
            }
          }
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error)
          return { success: false, error: message || 'Failed to update content ui state' }
        }
      }
    )
  })
}
