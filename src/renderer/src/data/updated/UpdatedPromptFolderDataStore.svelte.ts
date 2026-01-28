import { ipcInvoke } from '@renderer/api/ipcInvoke'

import { createUpdatedBaseDataStore } from './UpdatedBaseDataStore.svelte.ts'

export type UpdatedPromptFolder = {
  promptFolderId: string
  folderName: string
  displayName: string
  promptCount: number
  folderDescription: string
}

type LoadPromptFolderResult = {
  data: UpdatedPromptFolder
  revision: number
}

const promptFolderStore = createUpdatedBaseDataStore<UpdatedPromptFolder>()

export const getUpdatedPromptFolderEntry = (promptFolderId: string) =>
  promptFolderStore.getEntry(promptFolderId)

export const insertUpdatedPromptFolderDraft = (draft: UpdatedPromptFolder): string => {
  const promptFolderId = crypto.randomUUID()
  const nextDraft: UpdatedPromptFolder = { ...draft, promptFolderId }
  promptFolderStore.insertDraft(nextDraft, promptFolderId)
  return promptFolderId
}

export const completeUpdatedPromptFolderDraftInsert = (
  draftId: string,
  nextId: string,
  data: UpdatedPromptFolder,
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

export const fetchUpdatedPromptFolder = (
  promptFolderId: string,
  data: UpdatedPromptFolder,
  revision: number
): void => {
  promptFolderStore.applyFetch(promptFolderId, { data, revision })
}

export const syncUpdatedPromptFolder = (
  promptFolderId: string,
  data: UpdatedPromptFolder,
  revision: number
): void => {
  promptFolderStore.applySync(promptFolderId, { data, revision })
}

export const refetchUpdatedPromptFolder = async (promptFolderId: string): Promise<void> => {
  try {
    // TODO: replace with the real prompt-folder-by-id IPC channel (metadata only, no prompt bodies).
    const result = await ipcInvoke<LoadPromptFolderResult>('load-prompt-folder-by-id', {
      promptFolderId
    })
    fetchUpdatedPromptFolder(promptFolderId, result.data, result.revision)
  } catch (error) {
    console.error('Failed to refetch prompt folder:', error)
  }
}
