import type { UpdatedPromptFolderData as PromptFolderData } from '@shared/ipc'

import { createBaseDataStore } from './UpdatedBaseDataStore.svelte.ts'

const promptFolderStore = createBaseDataStore<PromptFolderData>()

export const getPromptFolderEntry = (promptFolderId: string) =>
  promptFolderStore.getEntry(promptFolderId)

export const optimisticInsertPromptFolderDraft = (draft: PromptFolderData): string => {
  const promptFolderId = crypto.randomUUID()
  const nextDraft: PromptFolderData = { ...draft, promptFolderId }
  promptFolderStore.optimisticInsert(nextDraft, promptFolderId)
  return promptFolderId
}

export const commitPromptFolderDraftInsert = (
  draftId: string,
  nextId: string,
  data: PromptFolderData,
  revision: number
): void => {
  promptFolderStore.commitDraftInsert(draftId, nextId, { data, revision })
}

export const optimisticDeletePromptFolderDraft = (promptFolderId: string): void => {
  promptFolderStore.optimisticDelete(promptFolderId)
}

export const revertPromptFolderDraftFromBase = (promptFolderId: string): void => {
  promptFolderStore.revertDraftFromBase(promptFolderId)
}

export const commitPromptFolderDeletion = (promptFolderId: string): void => {
  promptFolderStore.commitDeletion(promptFolderId)
}

export const applyFetchPromptFolder = (
  promptFolderId: string,
  data: PromptFolderData,
  revision: number
): void => {
  promptFolderStore.applyFetch(promptFolderId, { data, revision })
}

export const applyOptimisticUpdatedPromptFolder = (
  promptFolderId: string,
  data: PromptFolderData,
  revision: number
): void => {
  promptFolderStore.applyOptimisticChanges(promptFolderId, { data, revision })
}
