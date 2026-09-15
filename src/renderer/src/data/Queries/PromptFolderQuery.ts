import type {
  LoadPromptFolderInitialPayload,
  LoadPromptFolderInitialResult
} from '@shared/domain/prompt-folder/PromptFolder'
import { ipcInvokeWithPayload } from '@renderer/data/IpcFramework/IpcRequestInvoke'
import { runLoad } from '@renderer/data/IpcFramework/Load'
import { promptFolderCollection } from '@renderer/data/Collections/PromptFolderCollection'
import { collectPromptFolderGraphIds } from '@renderer/data/Collections/PromptFolderGraph'
import { markdownContentUiStateCollection } from '@renderer/data/Collections/MarkdownContentUiStateCollection'
import {
  setPromptFolderClientStateHasLoadedInitialData,
  upsertPromptFolderClientStates
} from '@renderer/data/UiState/client-state/PromptFolderClientState'
import { markdownContentQueryAdapters } from './MarkdownContentQueryAdapters'
import { categoryCollection } from '@renderer/data/Collections/CategoryCollection'

export const loadPromptFolderInitial = async (
  workspaceId: string,
  promptFolderId: string
): Promise<void> => {
  const previousGraph = collectPromptFolderGraphIds([promptFolderId])

  const result = await runLoad(() =>
    ipcInvokeWithPayload<LoadPromptFolderInitialResult, LoadPromptFolderInitialPayload>(
      'load-prompt-folder-initial',
      {
        workspaceId,
        promptFolderId
      }
    )
  )

  for (const adapter of markdownContentQueryAdapters) adapter.applyFolderResult(result)
  categoryCollection.utils.upsertManyAuthoritative(result.categories)
  promptFolderCollection.utils.upsertManyAuthoritative(result.promptFolders)
  upsertPromptFolderClientStates(result.promptFolders.map((promptFolder) => promptFolder.id))
  markdownContentUiStateCollection.utils.upsertManyAuthoritative(result.markdownContentUiStates)
  setPromptFolderClientStateHasLoadedInitialData(promptFolderId, true)

  // Prune client state against the reconciled collection state after applying the load result.
  if (!promptFolderCollection.get(promptFolderId)) {
    throw new Error('Prompt folder not loaded after initial load')
  }
  const nextGraph = collectPromptFolderGraphIds([promptFolderId])
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
