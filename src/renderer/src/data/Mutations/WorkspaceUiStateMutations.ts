import type { WorkspaceUiState } from '@shared/domain/ui-state/UiState'
import { planSetWorkspaceUiStateDomainMutation } from '@shared/domain/ui-state/UiStateDomainMutations'
import { mutatePacedRendererDomainMutation } from '@renderer/data/IpcFramework/RendererDomainMutation'

/** Queues one complete workspace-level UI-state replacement. */
export const setWorkspaceUiStateWithAutosave = (
  uiState: WorkspaceUiState,
  debounceMs: number
): void => {
  mutatePacedRendererDomainMutation({
    mutation: { command: uiState, plan: planSetWorkspaceUiStateDomainMutation },
    ipc: { channel: 'set-workspace-ui-state' },
    renderer: {},
    pacing: {
      target: { entityType: 'workspaceUiState', id: uiState.workspaceId },
      debounceMs
    }
  })
}
