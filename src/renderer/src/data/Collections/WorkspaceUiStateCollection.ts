import { createCollection } from '@tanstack/svelte-db'
import type { WorkspaceUiState } from '@shared/UiState'
import { revisionCollectionOptions } from './RevisionCollection'

/** Authoritative workspace-level UI state, ready for renderer hydration in the next phase. */
export const workspaceUiStateCollection = createCollection(
  revisionCollectionOptions<WorkspaceUiState>({
    id: 'workspace-ui-state',
    getKey: (uiState) => uiState.workspaceId,
    targetPolicy: 'deleteIfPresent'
  })
)
