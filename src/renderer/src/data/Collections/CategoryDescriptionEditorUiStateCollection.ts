import { createCollection } from '@tanstack/svelte-db'
import {
  createCategoryDescriptionEditorUiStateKey,
  type CategoryDescriptionEditorUiState
} from '@shared/UiState'
import { revisionCollectionOptions } from './RevisionCollection'

/** Authoritative category-description editor UI state, ready for hydration in the next phase. */
export const categoryDescriptionEditorUiStateCollection = createCollection(
  revisionCollectionOptions<CategoryDescriptionEditorUiState>({
    id: 'category-description-editor-ui-state',
    getKey: (uiState) =>
      createCategoryDescriptionEditorUiStateKey(uiState.workspaceId, uiState.categoryId)
  })
)
