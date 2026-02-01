import type {
  ResponseData,
  UpdatedPromptFolderData as PromptFolderData
} from '@shared/ipc/updatedTypes'

import { createBaseDataStore } from './UpdatedBaseDataStore.svelte.ts'

const promptFolderStore = createBaseDataStore<PromptFolderData>()

export const getPromptFolderEntry = (promptFolderId: string) =>
  promptFolderStore.getEntry(promptFolderId)

export const optimisticInsertPromptFolderDraft = (draft: PromptFolderData): string => {
  return promptFolderStore.optimisticInsert(draft)
}

export const optimisticDeletePromptFolderDraft = (promptFolderId: string): void => {
  promptFolderStore.optimisticDelete(promptFolderId)
}

// After rekeying, mergeAuthoritativePromptFolderSnapshot(response.id, response.data, response.revision).
export const rekeyPromptFolderEntry = (
  response: ResponseData<PromptFolderData>,
  rewriteReferences: (oldPromptFolderId: string, newPromptFolderId: string) => void
): void => {
  promptFolderStore.rekeyEntry(response.clientTempId!, response.id, rewriteReferences)
}

export const mergeAuthoritativePromptFolderSnapshot = (
  promptFolderId: string,
  data: PromptFolderData,
  revision: number,
  conflict = false
): void => {
  promptFolderStore.mergeAuthoritativeSnapshot(
    promptFolderId,
    { data, revision },
    conflict
  )
}
