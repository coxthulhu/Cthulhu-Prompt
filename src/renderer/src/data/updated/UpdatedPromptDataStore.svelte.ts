import type { UpdatedPromptData as PromptData } from '@shared/ipc/updatedTypes'

import { createBaseDataStore } from './UpdatedBaseDataStore.svelte.ts'

const promptStore = createBaseDataStore<PromptData>()

export const getPromptEntry = (promptId: string) => promptStore.getEntry(promptId)

export const optimisticInsertPromptDraft = (draft: PromptData): string => {
  const promptId = crypto.randomUUID()
  promptStore.optimisticInsert(draft, promptId)
  return promptId
}

export const optimisticDeletePromptDraft = (promptId: string): void => {
  promptStore.optimisticDelete(promptId)
}

export const applyFetchPrompt = (
  promptId: string,
  data: PromptData,
  revision: number
): void => {
  promptStore.mergeAuthoritativeSnapshot(promptId, { data, revision })
}

export const mergeAuthoritativePromptSnapshot = (
  promptId: string,
  data: PromptData,
  revision: number,
  conflict = false
): void => {
  promptStore.mergeAuthoritativeSnapshot(promptId, { data, revision }, conflict)
}
