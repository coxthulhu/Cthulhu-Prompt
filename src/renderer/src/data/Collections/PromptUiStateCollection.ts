import { createCollection } from '@tanstack/svelte-db'
import type { PromptUiState } from '@shared/PromptUiState'
import { revisionCollectionOptions } from './RevisionCollection'

export const promptUiStateCollection = createCollection(
  revisionCollectionOptions<PromptUiState>({
    id: 'prompt-ui-state',
    getKey: (promptUiState) => promptUiState.promptId
  })
)
