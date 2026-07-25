import { createCollection, localOnlyCollectionOptions } from '@tanstack/svelte-db'
import type { MarkdownContentUiState } from '@shared/MarkdownContentUiState'

export type MarkdownContentUiStateDraftRecord = MarkdownContentUiState

// Local-only draft state for persisted Monaco editor view states.
export const markdownContentUiStateDraftCollection = createCollection(
  localOnlyCollectionOptions<MarkdownContentUiStateDraftRecord>({
    id: 'markdown-content-ui-state-drafts',
    getKey: (draft) => draft.contentId
  })
)
