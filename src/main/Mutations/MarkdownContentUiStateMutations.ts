import { ipcMain } from 'electron'
import {
  UPDATE_MARKDOWN_CONTENT_UI_STATE_CHANNEL,
  type MarkdownContentUiStateRevisionResponsePayload
} from '@shared/MarkdownContentUiState'
import {
  createMarkdownContentUiStateRevisionKey,
  MarkdownContentUiStateDataAccess
} from '../DataAccess/MarkdownContentUiStateDataAccess'
import { parseUpdateMarkdownContentUiStateRevisionRequest } from '../IpcFramework/IpcValidation'
import { runMutationIpcRequest } from '../IpcFramework/IpcRequest'
import { revisions } from '../Registries/Revisions'

const buildRevisionPayload = (
  contentId: string,
  data: MarkdownContentUiStateRevisionResponsePayload['markdownContentUiState']['data'],
  revision: number
): MarkdownContentUiStateRevisionResponsePayload['markdownContentUiState'] => ({
  id: contentId,
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
          const contentId = entity.id
          const nextUiState = { ...entity.data, contentId }
          const revisionKey = createMarkdownContentUiStateRevisionKey(
            nextUiState.workspaceId,
            contentId
          )
          const currentRevision = revisions.markdownContentUiState.get(revisionKey)

          if (entity.expectedRevision !== currentRevision) {
            const currentUiState =
              MarkdownContentUiStateDataAccess.readMarkdownContentUiState(
                nextUiState.workspaceId,
                contentId
              )
            return {
              success: false,
              conflict: true,
              payload: {
                markdownContentUiState: buildRevisionPayload(
                  contentId,
                  currentUiState ?? nextUiState,
                  currentRevision
                )
              }
            }
          }

          const uiState = MarkdownContentUiStateDataAccess.upsertMarkdownContentUiState(nextUiState)
          const revision = revisions.markdownContentUiState.bump(revisionKey)
          return {
            success: true,
            payload: {
              markdownContentUiState: buildRevisionPayload(contentId, uiState, revision)
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
