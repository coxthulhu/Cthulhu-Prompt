import type { Prompt } from '@shared/ipc'
import { ipcInvoke } from '@renderer/api/ipcInvoke'

import { enqueueUpdatedLoad } from '../queues/UpdatedLoadsQueue'
import { runUpdatedRefetch } from './updatedIpcHelpers'

type UpdatedPromptLoadResult = {
  data: Prompt
  revision: number
}

export const refetchUpdatedPromptById = (
  promptId: string,
  applyFetch: (id: string, data: Prompt, revision: number) => void
): Promise<void> =>
  runUpdatedRefetch('prompt', async () => {
    const result = await enqueueUpdatedLoad(() =>
      ipcInvoke<UpdatedPromptLoadResult>('updated-load-prompt-by-id', { promptId })
    )
    applyFetch(promptId, result.data, result.revision)
  })

// TODO: add updated prompt mutation IPC methods.
