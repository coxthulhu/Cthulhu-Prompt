import { ipcInvoke } from '@renderer/api/ipcInvoke'

import type { UpdatedPromptFolder } from '../UpdatedPromptFolderDataStore.svelte.ts'
import { enqueueUpdatedLoad } from '../queues/UpdatedLoadsQueue'

type UpdatedPromptFolderLoadResult = {
  data: UpdatedPromptFolder
  revision: number
}

export const refetchUpdatedPromptFolderById = (
  promptFolderId: string
): Promise<UpdatedPromptFolderLoadResult> =>
  enqueueUpdatedLoad(() =>
    ipcInvoke<UpdatedPromptFolderLoadResult>('load-prompt-folder-by-id', {
      promptFolderId
    })
  )

// TODO: add updated prompt folder mutation IPC methods.
