import type { Prompt } from '@shared/ipc'

import { createUpdatedBaseDataStore } from './UpdatedBaseDataStore.svelte.ts'
import { refetchUpdatedPromptById } from './ipc/promptIpc'

const promptStore = createUpdatedBaseDataStore<Prompt>()

export const getUpdatedPromptEntry = (promptId: string) => promptStore.getEntry(promptId)

export const insertUpdatedPromptDraft = (draft: Prompt): string => {
  const promptId = crypto.randomUUID()
  const nextDraft: Prompt = { ...draft, id: promptId }
  promptStore.insertDraft(nextDraft, promptId)
  return promptId
}

export const completeUpdatedPromptDraftInsert = (
  draftId: string,
  nextId: string,
  data: Prompt,
  revision: number
): void => {
  promptStore.completeDraftInsert(draftId, nextId, { data, revision })
}

export const deleteUpdatedPromptDraft = (promptId: string): void => {
  promptStore.deleteDraft(promptId)
}

export const restoreUpdatedPromptDraftFromBase = (promptId: string): void => {
  promptStore.restoreDraftFromBase(promptId)
}

export const completeUpdatedPromptDeletion = (promptId: string): void => {
  promptStore.completeDeletion(promptId)
}

export const applyFetchUpdatedPrompt = (
  promptId: string,
  data: Prompt,
  revision: number
): void => {
  promptStore.applyFetch(promptId, { data, revision })
}

export const syncUpdatedPrompt = (promptId: string, data: Prompt, revision: number): void => {
  promptStore.applySync(promptId, { data, revision })
}

export const refetchUpdatedPrompt = (promptId: string): Promise<void> =>
  refetchUpdatedPromptById(promptId, applyFetchUpdatedPrompt)
