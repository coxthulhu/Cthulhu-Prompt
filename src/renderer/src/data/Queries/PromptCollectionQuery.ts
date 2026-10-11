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
