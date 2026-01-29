import type { UpdatedPromptFolderData } from '@shared/ipc'

import { createUpdatedBaseDataStore } from './UpdatedBaseDataStore.svelte.ts'

const promptFolderStore = createUpdatedBaseDataStore<UpdatedPromptFolderData>()

export const getUpdatedPromptFolderEntry = (promptFolderId: string) =>
  promptFolderStore.getEntry(promptFolderId)

export const insertUpdatedPromptFolderDraft = (draft: UpdatedPromptFolderData): string => {
  const promptFolderId = crypto.randomUUID()
  const nextDraft: UpdatedPromptFolderData = { ...draft, promptFolderId }
  promptFolderStore.insertDraft(nextDraft, promptFolderId)
  return promptFolderId
}

export const completeUpdatedPromptFolderDraftInsert = (
  draftId: string,
  nextId: string,
  data: UpdatedPromptFolderData,
  revision: number
): void => {
  promptFolderStore.completeDraftInsert(draftId, nextId, { data, revision })
}

export const deleteUpdatedPromptFolderDraft = (promptFolderId: string): void => {
  promptFolderStore.deleteDraft(promptFolderId)
}

export const restoreUpdatedPromptFolderDraftFromBase = (promptFolderId: string): void => {
  promptFolderStore.restoreDraftFromBase(promptFolderId)
}

export const completeUpdatedPromptFolderDeletion = (promptFolderId: string): void => {
  promptFolderStore.completeDeletion(promptFolderId)
}

export const applyFetchUpdatedPromptFolder = (
  promptFolderId: string,
  data: UpdatedPromptFolderData,
  revision: number
): void => {
  promptFolderStore.applyFetch(promptFolderId, { data, revision })
}

export const applyOptimisticUpdatedPromptFolder = (
  promptFolderId: string,
  data: UpdatedPromptFolderData,
  revision: number
): void => {
  promptFolderStore.applyOptimisticChanges(promptFolderId, { data, revision })
}
