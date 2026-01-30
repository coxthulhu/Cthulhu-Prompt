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

export const commitPromptDraftInsert = (
  draftId: string,
  nextId: string,
  data: Prompt,
  revision: number
): void => {
  promptStore.commitDraftInsert(draftId, nextId, { data, revision })
}

export const optimisticDeletePromptDraft = (promptId: string): void => {
  promptStore.optimisticDelete(promptId)
}

export const revertPromptDraftFromLastServerSnapshot = (
  promptId: string
): void => {
  promptStore.revertDraftFromLastServerSnapshot(promptId)
}

export const commitPromptDeletion = (promptId: string): void => {
  promptStore.commitDeletion(promptId)
}

export const applyFetchPrompt = (
  promptId: string,
  data: Prompt,
  revision: number
): void => {
  promptStore.applyFetch(promptId, { data, revision })
}

export const applyOptimisticUpdatedPrompt = (
  promptId: string,
  data: Prompt,
  revision: number
): void => {
  promptStore.applyOptimisticChanges(promptId, { data, revision })
}
