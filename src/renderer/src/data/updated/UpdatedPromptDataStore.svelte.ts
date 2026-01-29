import type { Prompt } from '@shared/ipc'

import { createUpdatedBaseDataStore } from './UpdatedBaseDataStore.svelte.ts'

const promptStore = createUpdatedBaseDataStore<Prompt>()

export const getUpdatedPromptEntry = (promptId: string) => promptStore.getEntry(promptId)

export const insertUpdatedPromptDraft = (draft: Prompt): string => {
  const promptId = crypto.randomUUID()
  const nextDraft: Prompt = { ...draft, id: promptId }
  promptStore.insertDraft(nextDraft, promptId)
  return promptId
}

export const commitUpdatedPromptDraftInsert = (
  draftId: string,
  nextId: string,
  data: Prompt,
  revision: number
): void => {
  promptStore.commitDraftInsert(draftId, nextId, { data, revision })
}

export const deleteUpdatedPromptDraft = (promptId: string): void => {
  promptStore.deleteDraft(promptId)
}

export const revertUpdatedPromptDraftFromBase = (promptId: string): void => {
  promptStore.revertDraftFromBase(promptId)
}

export const commitUpdatedPromptDeletion = (promptId: string): void => {
  promptStore.commitDeletion(promptId)
}

export const applyFetchUpdatedPrompt = (
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
