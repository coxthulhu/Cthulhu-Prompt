import {
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
  contentId: string
): MarkdownContentUiState =>
  getLatestMutationModifiedRecord(
    transaction,
    markdownContentUiStateCollection.id,
    contentId,
    () => markdownContentUiStateCollection.get(contentId)!
  )

type MutationOptions = Parameters<
  typeof mutatePacedRevisionUpdateTransaction<MarkdownContentUiStateRevisionResponsePayload>
>[0]

export const mutatePacedMarkdownContentUiStateAutosaveUpdate = ({
  contentId,
  debounceMs,
  mutateOptimistically
}: Pick<MutationOptions, 'debounceMs' | 'mutateOptimistically'> & {
  contentId: string
}): void => {
  mutatePacedRevisionUpdateTransaction<MarkdownContentUiStateRevisionResponsePayload>({
    collectionId: markdownContentUiStateCollection.id,
    elementId: contentId,
    debounceMs,
    mutateOptimistically,
    persistMutations: async ({ entities, invoke, transaction }) => {
      const result = await invoke<{ payload: MarkdownContentUiStateRevisionPayload }>(
        UPDATE_MARKDOWN_CONTENT_UI_STATE_CHANNEL,
        {
          payload: {
            markdownContentUiState: entities.markdownContentUiState({
              id: contentId,
              data: readLatestUiState(transaction, contentId)
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
