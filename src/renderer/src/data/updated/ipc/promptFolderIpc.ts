import { ipcInvoke } from '@renderer/api/ipcInvoke'

import type { UpdatedPromptFolder } from '../UpdatedPromptFolderDataStore.svelte.ts'
import { enqueueUpdatedLoad } from '../queues/UpdatedLoadsQueue'
import { runUpdatedRefetch } from './updatedIpcHelpers'

type UpdatedPromptFolderLoadResult = {
  data: UpdatedPromptFolder
  revision: number
}

export const refetchUpdatedPromptFolderById = (
  promptFolderId: string,
  applyFetch: (id: string, data: UpdatedPromptFolder, revision: number) => void
): Promise<void> =>
  runUpdatedRefetch('prompt folder', async () => {
    const result = await enqueueUpdatedLoad(() =>
      ipcInvoke<UpdatedPromptFolderLoadResult>('updated-load-prompt-folder-by-id', {
        promptFolderId
      })
    )
    applyFetch(promptFolderId, result.data, result.revision)
  })

// TODO: add updated prompt folder mutation IPC methods.
