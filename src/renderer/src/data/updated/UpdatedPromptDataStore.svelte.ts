import type { Prompt } from '@shared/ipc'
import { ipcInvoke } from '@renderer/api/ipcInvoke'

import { createUpdatedBaseDataStore } from './UpdatedBaseDataStore.svelte.ts'

type LoadPromptResult = {
  data: Prompt
  revision: number
}

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

export const fetchUpdatedPrompt = (promptId: string, data: Prompt, revision: number): void => {
  promptStore.applyFetch(promptId, { data, revision })
}

export const syncUpdatedPrompt = (promptId: string, data: Prompt, revision: number): void => {
  promptStore.applySync(promptId, { data, revision })
}

export const refetchUpdatedPrompt = async (promptId: string): Promise<void> => {
  try {
    // TODO: replace with the real prompt-by-id IPC channel.
    const result = await ipcInvoke<LoadPromptResult>('load-prompt-by-id', { promptId })
    fetchUpdatedPrompt(promptId, result.data, result.revision)
  } catch (error) {
    console.error('Failed to refetch prompt:', error)
  }
}
