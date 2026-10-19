import { notesCollection } from '@renderer/data/Collections/NotesCollection'
import { attachedNoteUiStateCollection } from '@renderer/data/Collections/AttachedNoteUiStateCollection'
import { createAttachedNoteUiStateKey } from '@shared/domain/ui-state/AttachedNoteUiState'
import type {
  LoadPromptCollectionInitialPayload,
  LoadPromptCollectionInitialResult
} from '@shared/domain/prompt-collection/PromptCollection'
import { ipcInvokeWithPayload } from '@renderer/data/IpcFramework/IpcRequestInvoke'
import { runLoad } from '@renderer/data/IpcFramework/Load'
import { promptCollectionsCollection } from '@renderer/data/Collections/PromptCollectionsCollection'
import { collectPromptCollectionGraphIds } from '@renderer/data/Collections/PromptCollectionGraph'
import { markdownContentUiStateCollection } from '@renderer/data/Collections/MarkdownContentUiStateCollection'
import {
  setPromptCollectionClientStateHasLoadedInitialData,
  upsertPromptCollectionClientStates
} from '@renderer/data/UiState/client-state/PromptCollectionClientState'
import { markdownContentQueryAdapters } from './MarkdownContentQueryAdapters'
import { categoryCollection } from '@renderer/data/Collections/CategoryCollection'

export const loadPromptCollectionInitial = async (
  workspaceId: string,
  promptCollectionId: string
): Promise<void> => {
  const previousGraph = collectPromptCollectionGraphIds([promptCollectionId])

  const result = await runLoad(() =>
    ipcInvokeWithPayload<LoadPromptCollectionInitialResult, LoadPromptCollectionInitialPayload>(
      'load-prompt-collection-initial',
      {
        workspaceId,
        promptCollectionId
      }
    )
  )

  notesCollection.utils.upsertManyAuthoritative(result.notes)
  attachedNoteUiStateCollection.utils.upsertManyAuthoritative(result.attachedNoteUiStates)
  /** Only notes covered by this collection load can lose a saved visibility record. */
  const loadedNoteIds = new Set([...previousGraph.noteIds, ...result.notes.map((note) => note.id)])
  attachedNoteUiStateCollection.utils.deleteManyAuthoritative([...loadedNoteIds]
    .filter((id) => !result.attachedNoteUiStates.some((snapshot) => snapshot.data.noteId === id))
    .map((id) => createAttachedNoteUiStateKey(workspaceId, id)))
  for (const adapter of markdownContentQueryAdapters) adapter.applyCollectionResult(result)
  categoryCollection.utils.upsertManyAuthoritative(result.categories)
  promptCollectionsCollection.utils.upsertManyAuthoritative(result.promptCollections)
  upsertPromptCollectionClientStates(result.promptCollections.map((promptCollection) => promptCollection.id))
  markdownContentUiStateCollection.utils.upsertManyAuthoritative(result.markdownContentUiStates)
  setPromptCollectionClientStateHasLoadedInitialData(promptCollectionId, true)

  // Prune client state against the reconciled collection state after applying the load result.
  if (!promptCollectionsCollection.get(promptCollectionId)) {
    throw new Error('Prompt collection not loaded after initial load')
  }
  const nextGraph = collectPromptCollectionGraphIds([promptCollectionId])
  notesCollection.utils.deleteManyAuthoritative([...previousGraph.noteIds].filter((id) => !nextGraph.noteIds.has(id)))
  const removedCategoryIds = [...previousGraph.categoryIds].filter(
    (categoryId) => !nextGraph.categoryIds.has(categoryId)
  )
  categoryCollection.utils.deleteManyAuthoritative(removedCategoryIds)
  for (const adapter of markdownContentQueryAdapters) {
    const removedContentIds = [...previousGraph.contentIds[adapter.kind]].filter(
      (contentId) => !nextGraph.contentIds[adapter.kind].has(contentId)
    )
    adapter.delete(removedContentIds)
  }
}
