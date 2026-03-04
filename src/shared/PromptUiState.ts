import type { RevisionEnvelope, RevisionPayloadEntity } from './Revision'

export type PromptUiState = {
  workspaceId: string
  promptId: string
  editorViewStateJson: string
}

export const UPDATE_PROMPT_UI_STATE_CHANNEL = 'update-prompt-ui-state'

export type PromptUiStateRevisionPayload = {
  promptUiState: RevisionPayloadEntity<PromptUiState>
}

export type PromptUiStateRevisionResponsePayload = {
  promptUiState: RevisionEnvelope<PromptUiState>
}
