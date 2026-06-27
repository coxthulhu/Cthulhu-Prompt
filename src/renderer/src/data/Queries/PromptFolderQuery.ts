import type {
  LoadPromptFolderInitialPayload,
  LoadPromptFolderInitialResult
} from '@shared/PromptFolder'
import { createPromptFull } from '@shared/Prompt'
import { ipcInvokeWithPayload } from '../IpcFramework/IpcRequestInvoke'
import { runLoad } from '../IpcFramework/Load'
import { promptCollection } from '../Collections/PromptCollection'
import { promptFolderCollection } from '../Collections/PromptFolderCollection'
import { getPromptFolderPromptIds } from '../Collections/PromptFolderEntries'
import { promptUiStateCollection } from '../Collections/PromptUiStateCollection'
import { deletePromptDrafts, upsertPromptDrafts } from '../UiState/PromptDraftMutations.svelte.ts'
import {
  setPromptFolderDraftHasLoadedInitialData,
  upsertPromptFolderDrafts
} from '../UiState/PromptFolderDraftMutations.svelte.ts'
import { upsertPromptUiStateDrafts } from '../UiState/PromptUiStateDraftMutations.svelte.ts'

export const loadPromptFolderInitial = async (
  workspaceId: string,
  promptFolderId: string
): Promise<void> => {
  const previousPromptFolder = promptFolderCollection.get(promptFolderId)
  const previousPromptIds = new Set([
    ...(previousPromptFolder ? getPromptFolderPromptIds(previousPromptFolder) : []),
    ...(previousPromptFolder?.completedPromptIds ?? [])
  ])

  const result = await runLoad(() =>
    ipcInvokeWithPayload<LoadPromptFolderInitialResult, LoadPromptFolderInitialPayload>(
      'load-prompt-folder-initial',
      {
        workspaceId,
        promptFolderId
      }
    )
  )

  const fullPromptSnapshots = result.prompts.map((prompt) => ({
    ...prompt,
    data: createPromptFull(prompt.data)
  }))

  promptCollection.utils.upsertManyAuthoritative(fullPromptSnapshots)
  upsertPromptDrafts(fullPromptSnapshots.map((prompt) => prompt.data))
  promptFolderCollection.utils.upsertManyAuthoritative(result.promptFolders)
  upsertPromptFolderDrafts(result.promptFolders.map((promptFolder) => promptFolder.data))
  promptUiStateCollection.utils.upsertManyAuthoritative(result.promptUiStates)
  upsertPromptUiStateDrafts(result.promptUiStates.map((promptUiState) => promptUiState.data))
  setPromptFolderDraftHasLoadedInitialData(promptFolderId, true)

  // Prune drafts against the reconciled collection state after applying the load result.
  const nextPromptFolder = promptFolderCollection.get(promptFolderId)
  if (!nextPromptFolder) {
    throw new Error('Prompt folder not loaded after initial load')
  }
  const nextPromptIds = new Set([
    ...getPromptFolderPromptIds(nextPromptFolder),
    ...nextPromptFolder.completedPromptIds
  ])
  const removedPromptIds: string[] = []

  for (const previousPromptId of previousPromptIds) {
    if (!nextPromptIds.has(previousPromptId)) {
      removedPromptIds.push(previousPromptId)
    }
  }

  promptCollection.utils.deleteManyAuthoritative(removedPromptIds)
  deletePromptDrafts(removedPromptIds)
}
