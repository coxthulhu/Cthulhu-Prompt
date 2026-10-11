import { createCollection } from '@tanstack/svelte-db'
import {
  createWorkspacePromptCollectionUiStateKey,
  type WorkspacePromptCollectionUiState
} from '@shared/domain/ui-state/UiState'
import { revisionCollectionOptions } from './RevisionCollection'

/** Authoritative prompt-collection view UI state, ready for renderer hydration in the next phase. */
export const workspacePromptCollectionUiStateCollection = createCollection(
  revisionCollectionOptions<WorkspacePromptCollectionUiState>({
    id: 'workspace-prompt-collection-ui-state',
    getKey: (uiState) =>
      createWorkspacePromptCollectionUiStateKey(uiState.workspaceId, uiState.contentOwnerId),
    targetPolicy: 'deleteIfPresent'
  })
)
