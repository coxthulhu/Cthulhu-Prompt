import type { DomainPlanner } from './DomainChanges'

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

/** Strict runtime parser for complete markdown editor UI-state commands. */
export const parseSetMarkdownContentUiStateDomainCommand = (
  value: unknown
): MarkdownContentUiState | null => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null
  /** Raw command fields validated without allowing additional properties. */
  const record = value as Record<string, unknown>
  if (
    Object.keys(record).length !== 3 ||
    typeof record.workspaceId !== 'string' ||
    typeof record.contentId !== 'string' ||
    typeof record.editorViewStateJson !== 'string'
  ) {
    return null
  }
  return record as MarkdownContentUiState
}

/** Plans one insert-or-update markdown editor UI-state replacement. */
export const planSetMarkdownContentUiStateDomainMutation: DomainPlanner<MarkdownContentUiState> = (
  state,
  command
) => {
  /** Composite authoritative key shared by the renderer and SQLite row. */
  const id = createMarkdownContentUiStateKey(command.workspaceId, command.contentId)
  /** Existing authoritative state deciding whether persistence inserts or updates. */
  const existing = state.get('markdownContentUiState', id)
  return existing
    ? [
        {
          type: 'update',
          entityType: 'markdownContentUiState',
          id,
          recipe: (draft) => {
            Object.assign(draft, command)
          }
        }
      ]
    : [{ type: 'insert', entityType: 'markdownContentUiState', id, data: command }]
}
