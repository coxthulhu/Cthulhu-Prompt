import type {
  Prompt,
  UpdatedPromptFolderData as PromptFolderData
} from '@shared/ipc'
import { ipcInvoke } from '@renderer/api/ipcInvoke'

import { applyFetchPrompt } from '../UpdatedPromptDataStore.svelte.ts'
import { applyFetchPromptFolder } from '../UpdatedPromptFolderDataStore.svelte.ts'
import { enqueueLoad } from '../queues/UpdatedLoadsQueue'
import { runRefetch } from './UpdatedIpcHelpers'

type PromptFolderLoadResult = {
  data: PromptFolderData
  revision: number
}

type PromptFolderInitialLoadResult = {
  promptFolder: { data: PromptFolderData; revision: number }
  prompts: Array<{ data: Prompt; revision: number }>
}

export const refetchPromptFolderById = (promptFolderId: string): Promise<void> =>
  runRefetch('prompt folder', async () => {
    const result = await enqueueLoad(() =>
      ipcInvoke<PromptFolderLoadResult>('updated-load-prompt-folder-by-id', {
        promptFolderId
      })
    )
    applyFetchPromptFolder(promptFolderId, result.data, result.revision)
  })

export const loadPromptFolderInitial = (promptFolderId: string): Promise<void> =>
  runRefetch('prompt folder initial load', async () => {
    const result = await enqueueLoad(() =>
      ipcInvoke<PromptFolderInitialLoadResult>('updated-load-prompt-folder-initial', {
        promptFolderId
      })
    )

    applyFetchPromptFolder(
      promptFolderId,
      result.promptFolder.data,
      result.promptFolder.revision
    )

    for (const prompt of result.prompts) {
      applyFetchPrompt(prompt.data.id, prompt.data, prompt.revision)
    }
  })
