import { createCollection } from '@tanstack/svelte-db'
import type { MarkdownContentUiState } from '@shared/MarkdownContentUiState'
import { revisionCollectionOptions } from './RevisionCollection'

export const markdownContentUiStateCollection = createCollection(
  revisionCollectionOptions<MarkdownContentUiState>({
    id: 'markdown-content-ui-state',
    getKey: (uiState) => uiState.contentId
  })
)
