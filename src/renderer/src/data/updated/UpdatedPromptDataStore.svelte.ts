import type { Prompt } from '@shared/ipc'

import { createBaseDataStore } from './UpdatedBaseDataStore.svelte.ts'

const promptStore = createBaseDataStore<Prompt>()

export const getPromptEntry = (promptId: string) => promptStore.getEntry(promptId)

export const optimisticInsertPromptDraft = (draft: Prompt): string => {
  const promptId = crypto.randomUUID()
  const nextDraft: Prompt = { ...draft, id: promptId }
  promptStore.optimisticInsert(nextDraft, promptId)
  return promptId
}

export const optimisticDeletePromptDraft = (promptId: string): void => {
  promptStore.optimisticDelete(promptId)
}

export const applyFetchPrompt = (
  promptId: string,
  data: Prompt,
  revision: number
): void => {
  promptStore.applyFetch(promptId, { data, revision })
}
