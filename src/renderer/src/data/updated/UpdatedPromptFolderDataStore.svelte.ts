import type { UpdatedPromptFolderData as PromptFolderData } from '@shared/ipc/updatedTypes'

import { createBaseDataStore } from './UpdatedBaseDataStore.svelte.ts'

const promptFolderStore = createBaseDataStore<PromptFolderData>()

export const getPromptFolderEntry = (promptFolderId: string) =>
  promptFolderStore.getEntry(promptFolderId)

export const optimisticInsertPromptFolderDraft = (draft: PromptFolderData): string => {
  const promptFolderId = crypto.randomUUID()
  promptFolderStore.optimisticInsert(draft, promptFolderId)
  return promptFolderId
}

export const optimisticDeletePromptFolderDraft = (promptFolderId: string): void => {
  promptFolderStore.optimisticDelete(promptFolderId)
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
