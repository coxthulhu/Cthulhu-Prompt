import { createCollection } from '@tanstack/svelte-db'
import {
  createMarkdownContentUiStateKey,
  type MarkdownContentUiState
} from '@shared/MarkdownContentUiState'
import { revisionCollectionOptions } from './RevisionCollection'

export const markdownContentUiStateCollection = createCollection(
  revisionCollectionOptions<MarkdownContentUiState>({
    id: 'markdown-content-ui-state',
    getKey: (uiState) => createMarkdownContentUiStateKey(uiState.workspaceId, uiState.contentId)
  })
)
