import {
  createMarkdownContentUiStateKey
} from '@shared/MarkdownContentUiState'
import { AUTOSAVE_MS } from '@renderer/data/draftAutosave'
import { markdownContentUiStateCollection } from '../Collections/MarkdownContentUiStateCollection'
import { submitPacedUpdateTransactionAndWait } from '../IpcFramework/RevisionCollections'
import { mutatePacedMarkdownContentUiStateAutosaveUpdate } from '../Mutations/MarkdownContentUiStateMutations'

/** Returns the saved Monaco editor view state for one markdown content record. */
export const lookupMarkdownContentEditorViewStateJson = (
  workspaceId: string | null,
  contentId: string
): string | null =>
  workspaceId === null
    ? null
    : (markdownContentUiStateCollection.get(
        createMarkdownContentUiStateKey(workspaceId, contentId)
      )?.editorViewStateJson ?? null)

/** Queues a changed Monaco editor view state for optimistic persistence. */
export const setMarkdownContentEditorViewStateJson = (
  workspaceId: string,
  contentId: string,
  editorViewStateJson: string | null
): void => {
  if (editorViewStateJson === null) return
  /** Composite authoritative ID for the workspace-scoped content state. */
  const uiStateId = createMarkdownContentUiStateKey(workspaceId, contentId)
  /** Current UI state used to skip an unchanged editor-view-state write. */
  const existing = markdownContentUiStateCollection.get(uiStateId)
  if (existing?.editorViewStateJson === editorViewStateJson) {
    return
  }

  mutatePacedMarkdownContentUiStateAutosaveUpdate({
    uiState: { workspaceId, contentId, editorViewStateJson },
    debounceMs: AUTOSAVE_MS
  })
}

/** Removes authoritative markdown UI-state records for deleted content. */
export const deleteMarkdownContentUiStates = (contentIds: string[]): void => {
  if (contentIds.length === 0) return
  /** Composite authoritative IDs belonging to the deleted markdown content. */
  const uiStateIds = markdownContentUiStateCollection.toArray
    .filter((uiState) => contentIds.includes(uiState.contentId))
    .map((uiState) => createMarkdownContentUiStateKey(uiState.workspaceId, uiState.contentId))
  markdownContentUiStateCollection.utils.deleteManyAuthoritative(uiStateIds)
}

/** Flushes every pending markdown UI-state autosave. */
export const flushMarkdownContentUiStateAutosaves = async (): Promise<void> => {
  await Promise.allSettled(
    markdownContentUiStateCollection.toArray.map((uiState) =>
      submitPacedUpdateTransactionAndWait(
        markdownContentUiStateCollection.id,
        createMarkdownContentUiStateKey(uiState.workspaceId, uiState.contentId)
      )
    )
  )
}

/** Clears markdown UI state when the selected workspace changes. */
export const clearMarkdownContentUiStateCollection = (): void => {
  markdownContentUiStateCollection.utils.deleteManyAuthoritative(
    Array.from(markdownContentUiStateCollection.keys(), (uiStateId) => String(uiStateId))
  )
}
