import type { MarkdownContentUiState } from '@shared/MarkdownContentUiState'
import { AUTOSAVE_MS } from '@renderer/data/draftAutosave'
import { markdownContentUiStateCollection } from '../Collections/MarkdownContentUiStateCollection'
import { submitPacedUpdateTransactionAndWait } from '../IpcFramework/RevisionCollections'
import { mutatePacedMarkdownContentUiStateAutosaveUpdate } from '../Mutations/MarkdownContentUiStateMutations'

/** Returns the saved Monaco editor view state for one markdown content record. */
export const lookupMarkdownContentEditorViewStateJson = (contentId: string): string | null =>
  markdownContentUiStateCollection.get(contentId)?.editorViewStateJson ?? null

/** Queues a changed Monaco editor view state for optimistic persistence. */
export const setMarkdownContentEditorViewStateJson = (
  workspaceId: string,
  contentId: string,
  editorViewStateJson: string | null
): void => {
  if (editorViewStateJson === null) return
  /** Current UI state used to skip an unchanged editor-view-state write. */
  const existing = markdownContentUiStateCollection.get(contentId)
  if (existing?.workspaceId === workspaceId && existing.editorViewStateJson === editorViewStateJson) {
    return
  }

  mutatePacedMarkdownContentUiStateAutosaveUpdate({
    contentId,
    debounceMs: AUTOSAVE_MS,
    mutateOptimistically: ({ collections }) => {
      /** Complete UI-state record applied by the optimistic transaction. */
      const next: MarkdownContentUiState = { workspaceId, contentId, editorViewStateJson }
      if (markdownContentUiStateCollection.has(contentId)) {
        collections.markdownContentUiState.update(contentId, (draft) =>
          Object.assign(draft, next)
        )
      } else {
        collections.markdownContentUiState.insert(next)
      }
    }
  })
}

/** Removes authoritative markdown UI-state records for deleted content. */
export const deleteMarkdownContentUiStates = (contentIds: string[]): void => {
  if (contentIds.length === 0) return
  markdownContentUiStateCollection.utils.deleteManyAuthoritative(contentIds)
}

/** Flushes every pending markdown UI-state autosave. */
export const flushMarkdownContentUiStateAutosaves = async (): Promise<void> => {
  await Promise.allSettled(
    markdownContentUiStateCollection.toArray.map((uiState) =>
      submitPacedUpdateTransactionAndWait(
        markdownContentUiStateCollection.id,
        uiState.contentId
      )
    )
  )
}

/** Clears markdown UI state when the selected workspace changes. */
export const clearMarkdownContentUiStateCollection = (): void => {
  deleteMarkdownContentUiStates(
    Array.from(markdownContentUiStateCollection.keys(), (contentId) => String(contentId))
  )
}
