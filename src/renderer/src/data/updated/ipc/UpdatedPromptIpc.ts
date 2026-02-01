import type {
  ResponseData,
  UpdatedPromptData as PromptData
} from '@shared/ipc/updatedTypes'
import { ipcInvoke } from '@renderer/api/ipcInvoke'

import { mergeAuthoritativePromptSnapshot } from '../UpdatedPromptDataStore.svelte.ts'
import { enqueueLoad } from '../queues/UpdatedLoadsQueue'
import { runRefetch } from './UpdatedIpcHelpers'

type PromptLoadResult = ResponseData<PromptData>

export const refetchPromptById = (promptId: string): Promise<void> =>
  runRefetch('prompt', async () => {
    const result = await enqueueLoad(() =>
      ipcInvoke<PromptLoadResult>('updated-load-prompt-by-id', { id: promptId })
    )
    mergeAuthoritativePromptSnapshot(
      result.id,
      result.data,
      result.revision,
      false,
      result.clientTempId
    )
  })
