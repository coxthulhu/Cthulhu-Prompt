import { createCollection } from '@tanstack/svelte-db'
import {
  createWorkspacePromptFolderUiStateKey,
  type WorkspacePromptFolderUiState
} from '@shared/UiState'
import { revisionCollectionOptions } from './RevisionCollection'

/** Authoritative prompt-folder view UI state, ready for renderer hydration in the next phase. */
export const workspacePromptFolderUiStateCollection = createCollection(
  revisionCollectionOptions<WorkspacePromptFolderUiState>({
    id: 'workspace-prompt-folder-ui-state',
    getKey: (uiState) =>
      createWorkspacePromptFolderUiStateKey(uiState.workspaceId, uiState.contentOwnerId),
    targetPolicy: 'deleteIfPresent'
  })
)
