import type { MarkdownContentUiState } from '@shared/MarkdownContentUiState'
import { AUTOSAVE_MS } from '@renderer/data/draftAutosave'
import { markdownContentUiStateCollection } from '../Collections/MarkdownContentUiStateCollection'
import { markdownContentUiStateDraftCollection } from '../Collections/MarkdownContentUiStateDraftCollection'
import { submitPacedUpdateTransactionAndWait } from '../IpcFramework/RevisionCollections'
import { mutatePacedMarkdownContentUiStateAutosaveUpdate } from '../Mutations/MarkdownContentUiStateMutations'

export const upsertMarkdownContentUiStateDrafts = (uiStates: MarkdownContentUiState[]): void => {
  const inserts = uiStates.filter((uiState) => !markdownContentUiStateDraftCollection.has(uiState.contentId))
  const updates = uiStates.filter((uiState) => markdownContentUiStateDraftCollection.has(uiState.contentId))
  if (inserts.length > 0) markdownContentUiStateDraftCollection.insert(inserts)
  for (const uiState of updates) {
    markdownContentUiStateDraftCollection.update(uiState.contentId, (draft) => {
      Object.assign(draft, uiState)
    })
  }
}

export const lookupMarkdownContentEditorViewStateJson = (contentId: string): string | null =>
  markdownContentUiStateDraftCollection.get(contentId)?.editorViewStateJson ?? null

export const setMarkdownContentEditorViewStateJson = (
  workspaceId: string,
  contentId: string,
  editorViewStateJson: string | null
): void => {
  if (editorViewStateJson === null) return
  const existing = markdownContentUiStateDraftCollection.get(contentId)
  if (existing?.workspaceId === workspaceId && existing.editorViewStateJson === editorViewStateJson) {
    return
  }

  mutatePacedMarkdownContentUiStateAutosaveUpdate({
    contentId,
    debounceMs: AUTOSAVE_MS,
    mutateOptimistically: ({ collections }) => {
      const next: MarkdownContentUiState = { workspaceId, contentId, editorViewStateJson }
      if (markdownContentUiStateCollection.has(contentId)) {
        collections.markdownContentUiState.update(contentId, (draft) => Object.assign(draft, next))
      } else {
        collections.markdownContentUiState.insert(next)
      }
      if (markdownContentUiStateDraftCollection.has(contentId)) {
        collections.markdownContentUiStateDraft.update(contentId, (draft) => Object.assign(draft, next))
      } else {
        collections.markdownContentUiStateDraft.insert(next)
      }
    }
  })
}

export const deleteMarkdownContentUiStates = (contentIds: string[]): void => {
  if (contentIds.length === 0) return
  markdownContentUiStateCollection.utils.deleteManyAuthoritative(contentIds)
  const draftIds = contentIds.filter((contentId) => markdownContentUiStateDraftCollection.has(contentId))
  if (draftIds.length > 0) markdownContentUiStateDraftCollection.delete(draftIds)
}

export const flushMarkdownContentUiStateAutosaves = async (): Promise<void> => {
  await Promise.allSettled(
    markdownContentUiStateDraftCollection.toArray.map((draft) =>
      submitPacedUpdateTransactionAndWait(markdownContentUiStateCollection.id, draft.contentId)
    )
  )
}

export const clearMarkdownContentUiStateStore = (): void => {
  deleteMarkdownContentUiStates(
    Array.from(markdownContentUiStateDraftCollection.keys(), (contentId) => String(contentId))
  )
}
