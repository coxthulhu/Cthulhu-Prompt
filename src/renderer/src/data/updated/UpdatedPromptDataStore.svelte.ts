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

// After rekeying, mergeAuthoritativePromptSnapshot(response.id, response.data, response.revision).
export const rekeyPromptEntry = (
  response: ResponseData<PromptData>,
  rewriteReferences: (oldPromptId: string, newPromptId: string) => void
): void => {
  promptStore.rekeyEntry(response.clientTempId!, response.id, rewriteReferences)
}

export const mergeAuthoritativePromptSnapshot = (
  promptId: string,
  data: PromptData,
  revision: number,
  conflict = false
): void => {
  promptStore.mergeAuthoritativeSnapshot(promptId, { data, revision }, conflict)
}
