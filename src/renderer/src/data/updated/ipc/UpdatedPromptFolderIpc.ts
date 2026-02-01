import type {
  ResponseData,
  UpdatedPromptData as PromptData,
  UpdatedPromptFolderData as PromptFolderData
} from '@shared/ipc/updatedTypes'
import { ipcInvoke } from '@renderer/api/ipcInvoke'

import { mergeAuthoritativePromptSnapshot } from '../UpdatedPromptDataStore.svelte.ts'
import { mergeAuthoritativePromptFolderSnapshot } from '../UpdatedPromptFolderDataStore.svelte.ts'
import { enqueueLoad } from '../queues/UpdatedLoadsQueue'
import { runRefetch } from './UpdatedIpcHelpers'

type PromptFolderLoadResult = ResponseData<PromptFolderData>

type PromptFolderInitialLoadResult = {
  promptFolder: ResponseData<PromptFolderData>
  prompts: Array<ResponseData<PromptData>>
}

export const refetchPromptFolderById = (promptFolderId: string): Promise<void> =>
  runRefetch('prompt folder', async () => {
    const result = await enqueueLoad(() =>
      ipcInvoke<PromptFolderLoadResult>('updated-load-prompt-folder-by-id', {
        id: promptFolderId
      })
    )
    mergeAuthoritativePromptFolderSnapshot(
      result.id,
      result.data,
      result.revision,
      false,
      result.clientTempId
    )
  })

export const loadPromptFolderInitial = (promptFolderId: string): Promise<void> =>
  runRefetch('prompt folder initial load', async () => {
    const result = await enqueueLoad(() =>
      ipcInvoke<PromptFolderInitialLoadResult>('updated-load-prompt-folder-initial', {
        id: promptFolderId
      })
    )

    mergeAuthoritativePromptFolderSnapshot(
      result.promptFolder.id,
      result.promptFolder.data,
      result.promptFolder.revision,
      false,
      result.promptFolder.clientTempId
    )

    for (const prompt of result.prompts) {
      mergeAuthoritativePromptSnapshot(
        prompt.id,
        prompt.data,
        prompt.revision,
        false,
        prompt.clientTempId
      )
    }
  })
