import type {
  LoadPromptFolderInitialPayload,
  LoadPromptFolderInitialResult
} from '@shared/PromptFolder'
import { ipcInvokeWithPayload } from '../IpcFramework/IpcRequestInvoke'
import { runLoad } from '../IpcFramework/Load'
import { promptFolderCollection } from '../Collections/PromptFolderCollection'
import { collectPromptFolderGraphIds } from '../Collections/PromptFolderGraph'
import { promptUiStateCollection } from '../Collections/PromptUiStateCollection'
import {
  setPromptFolderDraftHasLoadedInitialData,
  upsertPromptFolderDrafts
} from '../UiState/PromptFolderDraftMutations.svelte.ts'
import { upsertPromptUiStateDrafts } from '../UiState/PromptUiStateDraftMutations.svelte.ts'
import { markdownContentQueryAdapters } from './MarkdownContentQueryAdapters'

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
  promptFolderCollection.utils.upsertManyAuthoritative(result.promptFolders)
  upsertPromptFolderDrafts(result.promptFolders.map((promptFolder) => promptFolder.data))
  promptUiStateCollection.utils.upsertManyAuthoritative(result.promptUiStates)
  upsertPromptUiStateDrafts(result.promptUiStates.map((promptUiState) => promptUiState.data))
  setPromptFolderDraftHasLoadedInitialData(promptFolderId, true)

  // Prune drafts against the reconciled collection state after applying the load result.
  if (!promptFolderCollection.get(promptFolderId)) {
    throw new Error('Prompt folder not loaded after initial load')
  }
  const nextGraph = collectPromptFolderGraphIds([promptFolderId])
  for (const adapter of markdownContentQueryAdapters) {
    const removedContentIds = [...previousGraph.contentIds[adapter.kind]].filter(
      (contentId) => !nextGraph.contentIds[adapter.kind].has(contentId)
    )
    adapter.delete(removedContentIds)
  }
}
