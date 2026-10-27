import { notesCollection } from '@renderer/data/Collections/NotesCollection'
import { deleteNoteClientStates } from '@renderer/data/UiState/client-state/NoteClientState'
import { attachedNoteUiStateCollection } from '@renderer/data/Collections/AttachedNoteUiStateCollection'
import { createAttachedNoteUiStateKey } from '@shared/domain/ui-state/AttachedNoteUiState'
import {
  getAllWorkspaceCollectionEntries,
  type LoadWorkspaceByPathRequest,
  type LoadWorkspaceByPathResult
} from '@shared/domain/workspace/Workspace'
import { ipcInvokeWithPayload } from '@renderer/data/IpcFramework/IpcRequestInvoke'
import { runLoad } from '@renderer/data/IpcFramework/Load'
import { promptCollectionsCollection } from '@renderer/data/Collections/PromptCollectionsCollection'
import { collectPromptCollectionGraphIds } from '@renderer/data/Collections/PromptCollectionGraph'
import {
  deletePromptCollectionClientStates,
  upsertPromptCollectionClientStates
} from '@renderer/data/UiState/client-state/PromptCollectionClientState'
import { workspaceCollection } from '@renderer/data/Collections/WorkspaceCollection'
import { markdownContentQueryAdapters } from './MarkdownContentQueryAdapters'
import { categoryCollection } from '@renderer/data/Collections/CategoryCollection'

export const loadWorkspaceByPath = async (workspaceInfoPath: string): Promise<string> => {
  const result = await runLoad(() =>
    ipcInvokeWithPayload<LoadWorkspaceByPathResult, LoadWorkspaceByPathRequest>(
      'load-workspace-by-path',
      {
        workspaceInfoPath
      }
    )
  )

  const previousWorkspace = workspaceCollection.get(result.workspace.id)
  const previousGraph = previousWorkspace
    ? collectPromptCollectionGraphIds(
        getAllWorkspaceCollectionEntries(previousWorkspace).map((entry) => entry.id)
      )
    : null

  workspaceCollection.utils.upsertAuthoritative(result.workspace)
  categoryCollection.utils.upsertManyAuthoritative(result.categories)

  for (const promptCollection of result.promptCollections) {
    promptCollectionsCollection.utils.upsertAuthoritative(promptCollection)
  }
  upsertPromptCollectionClientStates(result.promptCollections.map((promptCollection) => promptCollection.id))
  notesCollection.utils.upsertManyAuthoritative(result.notes)
  attachedNoteUiStateCollection.utils.upsertManyAuthoritative(result.attachedNoteUiStates)
  // Remove only preferences proven absent from this workspace's complete load.
  attachedNoteUiStateCollection.utils.deleteManyAuthoritative(attachedNoteUiStateCollection.toArray
    .filter((state) => state.workspaceId === result.workspace.id &&
      !result.attachedNoteUiStates.some((snapshot) => snapshot.data.noteId === state.noteId))
    .map((state) => createAttachedNoteUiStateKey(state.workspaceId, state.noteId)))
  for (const adapter of markdownContentQueryAdapters) adapter.applyWorkspaceResult(result)

  if (!previousGraph) {
    return result.workspace.id
  }

  const nextPromptCollectionIds = new Set(result.promptCollections.map((collection) => collection.id))
  const removedPromptCollectionIds: string[] = []

  for (const promptCollectionId of previousGraph.promptCollectionIds) {
    if (!nextPromptCollectionIds.has(promptCollectionId)) {
      promptCollectionsCollection.utils.deleteAuthoritative(promptCollectionId)
      removedPromptCollectionIds.push(promptCollectionId)
    }
  }
  deletePromptCollectionClientStates(removedPromptCollectionIds)

  /** Prune note session state together with removed authoritative notes. */
  const removedNoteIds = [...previousGraph.noteIds].filter((id) => !result.notes.some((note) => note.id === id))
  notesCollection.utils.deleteManyAuthoritative(removedNoteIds)
  deleteNoteClientStates(removedNoteIds)
  const nextCategoryIds = new Set(result.categories.map((category) => category.id))
  const removedCategoryIds = [...previousGraph.categoryIds].filter(
    (categoryId) => !nextCategoryIds.has(categoryId)
  )
  categoryCollection.utils.deleteManyAuthoritative(removedCategoryIds)

  for (const adapter of markdownContentQueryAdapters) {
    const nextContentIds = adapter.getWorkspaceIds(result)
    const removedContentIds = [...previousGraph.contentIds[adapter.kind]].filter(
      (contentId) => !nextContentIds.has(contentId)
    )
    adapter.delete(removedContentIds)
  }

  return result.workspace.id
}
