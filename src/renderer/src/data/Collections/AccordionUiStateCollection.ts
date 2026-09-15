import { createCollection } from '@tanstack/svelte-db'
import { createAccordionUiStateKey, type AccordionUiState } from '@shared/domain/ui-state/UiState'
import { revisionCollectionOptions } from './RevisionCollection'

/** Authoritative accordion UI state, ready for renderer hydration in the next phase. */
export const accordionUiStateCollection = createCollection(
  revisionCollectionOptions<AccordionUiState>({
    id: 'accordion-ui-state',
    getKey: (uiState) => createAccordionUiStateKey(uiState.workspaceId, uiState.persistenceId),
    targetPolicy: 'deleteIfPresent'
  })
)
