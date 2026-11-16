import { ipcMain } from 'electron'
import {
  createDefaultWorkspaceUiState,
  LOAD_WORKSPACE_UI_STATE_CHANNEL,
  type LoadWorkspaceUiStateResult
} from '@shared/domain/ui-state/UiState'
import { data } from '../Data/Data'
import { parseLoadWorkspaceUiStateRequest } from '../IpcFramework/IpcValidation'
import { runQueryIpcRequest } from '../IpcFramework/IpcRequest'

/** Registers the workspace-scoped split UI-state startup query. */
export const setupUiStateQueryHandlers = (): void => {
  ipcMain.handle(
    LOAD_WORKSPACE_UI_STATE_CHANNEL,
    async (_, request: unknown): Promise<LoadWorkspaceUiStateResult> =>
      await runQueryIpcRequest(
        request,
        parseLoadWorkspaceUiStateRequest,
        async (validatedRequest) => {
          try {
            /** Workspace whose split UI-state tables are being hydrated. */
            const workspaceId = validatedRequest.payload.workspaceId
            await data.workspaceUiState.loadDataFromPersistence(workspaceId, {})
            if (!data.workspaceUiState.committedStore.getEntry(workspaceId)) {
              data.workspaceUiState.committedStore.setFromDisk(
                workspaceId,
                createDefaultWorkspaceUiState(workspaceId),
                {}
              )
            }

            /** Required workspace-level committed entry after default hydration. */
            const workspaceEntry = data.workspaceUiState.committedStore.getEntry(workspaceId)!

            return {
              success: true,
              workspaceUiState: {
                id: workspaceId,
                revision: workspaceEntry.revision,
                data: workspaceEntry.committed
              },

            }
          } catch (error) {
            return {
              success: false,
              error: error instanceof Error ? error.message : String(error)
            }
          }
        }
      )
  )
}
