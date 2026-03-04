import { createCollection, localOnlyCollectionOptions } from '@tanstack/svelte-db'
import type { PromptUiState } from '@shared/PromptUiState'

export type PromptUiStateDraftRecord = PromptUiState

// Local-only draft state for persisted Monaco editor view states.
export const promptUiStateDraftCollection = createCollection(
  localOnlyCollectionOptions<PromptUiStateDraftRecord>({
    id: 'prompt-ui-state-drafts',
    getKey: (draft) => draft.promptId
  })
)
