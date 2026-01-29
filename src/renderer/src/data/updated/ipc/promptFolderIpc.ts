import type { Prompt, UpdatedPromptFolderData } from '@shared/ipc'
import { ipcInvoke } from '@renderer/api/ipcInvoke'

import { applyFetchUpdatedPrompt } from '../UpdatedPromptDataStore.svelte.ts'
import { applyFetchUpdatedPromptFolder } from '../UpdatedPromptFolderDataStore.svelte.ts'
import { enqueueUpdatedLoad } from '../queues/UpdatedLoadsQueue'
import { runUpdatedRefetch } from './updatedIpcHelpers'

type UpdatedPromptFolderLoadResult = {
  data: UpdatedPromptFolderData
  revision: number
}

type UpdatedPromptFolderInitialLoadResult = {
  promptFolder: { data: UpdatedPromptFolderData; revision: number }
  prompts: Array<{ data: Prompt; revision: number }>
}

export const refetchUpdatedPromptFolderById = (promptFolderId: string): Promise<void> =>
  runUpdatedRefetch('prompt folder', async () => {
    const result = await enqueueUpdatedLoad(() =>
      ipcInvoke<UpdatedPromptFolderLoadResult>('updated-load-prompt-folder-by-id', {
        promptFolderId
      })
    )
    applyFetchUpdatedPromptFolder(promptFolderId, result.data, result.revision)
  })

export const loadUpdatedPromptFolderInitial = (promptFolderId: string): Promise<void> =>
  runUpdatedRefetch('prompt folder initial load', async () => {
    const result = await enqueueUpdatedLoad(() =>
      ipcInvoke<UpdatedPromptFolderInitialLoadResult>('updated-load-prompt-folder-initial', {
        promptFolderId
      })
    )

    applyFetchUpdatedPromptFolder(
      promptFolderId,
      result.promptFolder.data,
      result.promptFolder.revision
    )

    for (const prompt of result.prompts) {
      applyFetchUpdatedPrompt(prompt.data.id, prompt.data, prompt.revision)
    }
  })

// TODO: add updated prompt folder mutation IPC methods.
