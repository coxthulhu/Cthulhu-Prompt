import {
  LOAD_WORKSPACE_UI_STATE_CHANNEL,
  type LoadWorkspaceUiStateRequest,
  type LoadWorkspaceUiStateResult
} from '@shared/domain/ui-state/UiState'
import { workspaceUiStateCollection } from '@renderer/data/Collections/WorkspaceUiStateCollection'
import { ipcInvokeWithPayload } from '@renderer/data/IpcFramework/IpcRequestInvoke'
import { runLoad } from '@renderer/data/IpcFramework/Load'

/** Loads and reconciles every split UI-state collection for one selected workspace. */
export const loadWorkspaceUiState = async (workspaceId: string): Promise<void> => {
  /** Authoritative workspace UI-state snapshot response. */
  const result = await runLoad(() =>
    ipcInvokeWithPayload<LoadWorkspaceUiStateResult, LoadWorkspaceUiStateRequest>(
      LOAD_WORKSPACE_UI_STATE_CHANNEL,
      { workspaceId }
    )
  )
  workspaceUiStateCollection.utils.upsertAuthoritative(result.workspaceUiState)
}
