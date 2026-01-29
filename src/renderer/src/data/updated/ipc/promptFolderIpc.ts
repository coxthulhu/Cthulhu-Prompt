import type { Prompt, UpdatedPromptFolderData } from '@shared/ipc'
import { ipcInvoke } from '@renderer/api/ipcInvoke'

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

export const refetchUpdatedPromptFolderById = (
  promptFolderId: string,
  applyFetch: (id: string, data: UpdatedPromptFolderData, revision: number) => void
): Promise<void> =>
  runUpdatedRefetch('prompt folder', async () => {
    const result = await enqueueUpdatedLoad(() =>
      ipcInvoke<UpdatedPromptFolderLoadResult>('updated-load-prompt-folder-by-id', {
        promptFolderId
      })
    )
    applyFetch(promptFolderId, result.data, result.revision)
  })

export const loadUpdatedPromptFolderInitial = (
  promptFolderId: string,
  applyPromptFolderFetch: (id: string, data: UpdatedPromptFolderData, revision: number) => void,
  applyPromptFetch: (id: string, data: Prompt, revision: number) => void
): Promise<void> =>
  runUpdatedRefetch('prompt folder initial load', async () => {
    const result = await enqueueUpdatedLoad(() =>
      ipcInvoke<UpdatedPromptFolderInitialLoadResult>('updated-load-prompt-folder-initial', {
        promptFolderId
      })
    )

    applyPromptFolderFetch(
      promptFolderId,
      result.promptFolder.data,
      result.promptFolder.revision
    )

    for (const prompt of result.prompts) {
      applyPromptFetch(prompt.data.id, prompt.data, prompt.revision)
    }
  })

// TODO: add updated prompt folder mutation IPC methods.
