import type { Prompt } from '@shared/ipc'
import { ipcInvoke } from '@renderer/api/ipcInvoke'

import { mergeAuthoritativePromptSnapshot } from '../UpdatedPromptDataStore.svelte.ts'
import { enqueueLoad } from '../queues/UpdatedLoadsQueue'
import { runRefetch } from './UpdatedIpcHelpers'

type PromptLoadResult = {
  data: Prompt
  revision: number
}

export const refetchPromptById = (promptId: string): Promise<void> =>
  runRefetch('prompt', async () => {
    const result = await enqueueLoad(() =>
      ipcInvoke<PromptLoadResult>('updated-load-prompt-by-id', { promptId })
    )
    mergeAuthoritativePromptSnapshot(promptId, result.data, result.revision)
  })
