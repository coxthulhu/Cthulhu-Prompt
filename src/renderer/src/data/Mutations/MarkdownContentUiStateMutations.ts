import {
  createMarkdownContentUiStateKey,
  planSetMarkdownContentUiStateDomainMutation,
  UPDATE_MARKDOWN_CONTENT_UI_STATE_CHANNEL,
  type MarkdownContentUiState
} from '@shared/MarkdownContentUiState'
import { mutatePacedRendererDomainMutation } from '../IpcFramework/RendererDomainMutation'

/** Queues one complete markdown editor UI-state insert or update. */
export const mutatePacedMarkdownContentUiStateAutosaveUpdate = ({
  uiState,
  debounceMs,
}: {
  /** Complete desired editor UI-state record. */
  uiState: MarkdownContentUiState
  /** Debounce window restarted after each editor state capture. */
  debounceMs: number
}): void => {
  /** Composite authoritative ID shared by the renderer, IPC envelope, and main revision store. */
  const uiStateId = createMarkdownContentUiStateKey(uiState.workspaceId, uiState.contentId)
  mutatePacedRendererDomainMutation({
    mutation: { command: uiState, plan: planSetMarkdownContentUiStateDomainMutation },
    ipc: { channel: UPDATE_MARKDOWN_CONTENT_UI_STATE_CHANNEL },
    renderer: {},
    pacing: {
      target: { entityType: 'markdownContentUiState', id: uiStateId },
      debounceMs
    }
  })
}
