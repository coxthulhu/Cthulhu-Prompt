import type { Prompt } from '@shared/ipc'
import { ipcInvoke } from '@renderer/api/ipcInvoke'

import { enqueueUpdatedLoad } from '../queues/UpdatedLoadsQueue'

type UpdatedPromptLoadResult = {
  data: Prompt
  revision: number
}

export const refetchUpdatedPromptById = (
  promptId: string
): Promise<UpdatedPromptLoadResult> =>
  enqueueUpdatedLoad(() => ipcInvoke<UpdatedPromptLoadResult>('load-prompt-by-id', { promptId }))

// TODO: add updated prompt mutation IPC methods.
