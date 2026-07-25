import type { RevisionEnvelope, RevisionPayloadEntity } from './Revision'

// Monaco editor state shared by prompts and prompt templates.

export type MarkdownContentUiState = {
  workspaceId: string
  contentId: string
  editorViewStateJson: string
}

export const UPDATE_MARKDOWN_CONTENT_UI_STATE_CHANNEL = 'update-markdown-content-ui-state'

export type MarkdownContentUiStateRevisionPayload = {
  markdownContentUiState: RevisionPayloadEntity<MarkdownContentUiState>
}

export type MarkdownContentUiStateRevisionResponsePayload = {
  markdownContentUiState: RevisionEnvelope<MarkdownContentUiState>
}
