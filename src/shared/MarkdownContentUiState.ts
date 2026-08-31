import type { RevisionEnvelope, RevisionPayloadEntity } from './Revision'

// Monaco editor state shared by prompts and prompt templates.

export type MarkdownContentUiState = {
  workspaceId: string
  contentId: string
  editorViewStateJson: string
}

/** Builds the authoritative key for one workspace-scoped markdown UI-state record. */
export const createMarkdownContentUiStateKey = (
  workspaceId: string,
  contentId: string
): string => `${workspaceId}:${contentId}`

export const UPDATE_MARKDOWN_CONTENT_UI_STATE_CHANNEL = 'update-markdown-content-ui-state'

export type MarkdownContentUiStateRevisionPayload = {
  markdownContentUiState: RevisionPayloadEntity<MarkdownContentUiState>
}

export type MarkdownContentUiStateRevisionResponsePayload = {
  markdownContentUiState: RevisionEnvelope<MarkdownContentUiState>
}
