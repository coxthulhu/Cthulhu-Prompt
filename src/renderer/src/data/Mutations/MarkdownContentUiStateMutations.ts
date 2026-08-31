import {
  createMarkdownContentUiStateKey,
  UPDATE_MARKDOWN_CONTENT_UI_STATE_CHANNEL,
  type MarkdownContentUiState,
  type MarkdownContentUiStateRevisionPayload,
  type MarkdownContentUiStateRevisionResponsePayload
} from '@shared/MarkdownContentUiState'
import type { Transaction } from '@tanstack/svelte-db'
import { markdownContentUiStateCollection } from '../Collections/MarkdownContentUiStateCollection'
import { getLatestMutationModifiedRecord } from '../IpcFramework/RevisionMutationLookup'
import { mutatePacedRevisionUpdateTransaction } from '../IpcFramework/RevisionCollections'

const readLatestUiState = (
  transaction: Transaction<any>,
  uiStateId: string
): MarkdownContentUiState =>
  getLatestMutationModifiedRecord(
    transaction,
    markdownContentUiStateCollection.id,
    uiStateId,
    () => markdownContentUiStateCollection.get(uiStateId)!
  )

type MutationOptions = Parameters<
  typeof mutatePacedRevisionUpdateTransaction<MarkdownContentUiStateRevisionResponsePayload>
>[0]

export const mutatePacedMarkdownContentUiStateAutosaveUpdate = ({
  workspaceId,
  contentId,
  debounceMs,
  mutateOptimistically
}: Pick<MutationOptions, 'debounceMs' | 'mutateOptimistically'> & {
  workspaceId: string
  contentId: string
}): void => {
  /** Composite authoritative ID shared by the renderer, IPC envelope, and main revision store. */
  const uiStateId = createMarkdownContentUiStateKey(workspaceId, contentId)
  mutatePacedRevisionUpdateTransaction<MarkdownContentUiStateRevisionResponsePayload>({
    collectionId: markdownContentUiStateCollection.id,
    elementId: uiStateId,
    debounceMs,
    mutateOptimistically,
    persistMutations: async ({ entities, invoke, transaction }) => {
      const result = await invoke<{ payload: MarkdownContentUiStateRevisionPayload }>(
        UPDATE_MARKDOWN_CONTENT_UI_STATE_CHANNEL,
        {
          payload: {
            markdownContentUiState: entities.markdownContentUiState({
              id: uiStateId,
              data: readLatestUiState(transaction, uiStateId)
            })
          }
        }
      )
      return result
    },
    handleSuccessOrConflictResponse: (payload) => {
      markdownContentUiStateCollection.utils.upsertAuthoritative(payload.markdownContentUiState)
    },
    conflictMessage: 'Markdown content ui state update conflict'
  })
}
