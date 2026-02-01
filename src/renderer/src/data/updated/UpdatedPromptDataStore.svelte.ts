import type { ResponseData, UpdatedPromptData as PromptData } from '@shared/ipc/updatedTypes'

import { createBaseDataStore } from './UpdatedBaseDataStore.svelte.ts'

const promptStore = createBaseDataStore<PromptData>()

export const getPromptEntry = (promptId: string) => promptStore.getEntry(promptId)

export const optimisticInsertPromptDraft = (draft: PromptData): string => {
  return promptStore.optimisticInsert(draft)
}

export const optimisticDeletePromptDraft = (promptId: string): void => {
  promptStore.optimisticDelete(promptId)
}

// After rekeying, mergeAuthoritativePromptSnapshot(response).
export const rekeyPromptEntry = (
  response: ResponseData<PromptData>,
  rewriteReferences: (oldPromptId: string, newPromptId: string) => void
): void => {
  promptStore.rekeyEntry(response.clientTempId!, response.id, rewriteReferences)
}

export const mergeAuthoritativePromptSnapshot = (
  response: ResponseData<PromptData>,
  conflict = false
): void => {
  promptStore.mergeAuthoritativeSnapshot(
    response.id,
    { data: response.data, revision: response.revision },
    conflict,
    response.clientTempId
  )
}
