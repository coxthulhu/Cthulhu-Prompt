import type {
  LoadPromptFolderInitialPayload,
  LoadPromptFolderInitialResult
} from '@shared/PromptFolder'
import { createPromptFull } from '@shared/Prompt'
import { ipcInvokeWithPayload } from '../IpcFramework/IpcRequestInvoke'
import { runLoad } from '../IpcFramework/Load'
import { promptCollection } from '../Collections/PromptCollection'
import { promptFolderCollection } from '../Collections/PromptFolderCollection'
import { promptUiStateCollection } from '../Collections/PromptUiStateCollection'
import { deletePromptDrafts, upsertPromptDrafts } from '../UiState/PromptDraftMutations.svelte.ts'
import {
  setPromptFolderDraftHasLoadedInitialData,
  upsertPromptFolderDraft
} from '../UiState/PromptFolderDraftMutations.svelte.ts'
import { upsertPromptUiStateDrafts } from '../UiState/PromptUiStateDraftMutations.svelte.ts'

export const loadPromptFolderInitial = async (
  workspaceId: string,
  promptFolderId: string
): Promise<void> => {
  const previousPromptIds = new Set(promptFolderCollection.get(promptFolderId)?.promptIds ?? [])

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
  promptFolderCollection.utils.upsertAuthoritative(result.promptFolder)
  upsertPromptFolderDraft(result.promptFolder.data)
  promptUiStateCollection.utils.upsertManyAuthoritative(result.promptUiStates)
  upsertPromptUiStateDrafts(result.promptUiStates.map((promptUiState) => promptUiState.data))
  setPromptFolderDraftHasLoadedInitialData(promptFolderId, true)

  const nextPromptIds = new Set(result.promptFolder.data.promptIds)
  const removedPromptIds: string[] = []

  for (const previousPromptId of previousPromptIds) {
    if (!nextPromptIds.has(previousPromptId)) {
      removedPromptIds.push(previousPromptId)
    }
  }

  promptCollection.utils.deleteManyAuthoritative(removedPromptIds)
  deletePromptDrafts(removedPromptIds)
}
