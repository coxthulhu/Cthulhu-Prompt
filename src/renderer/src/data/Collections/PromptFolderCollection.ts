import { createCollection } from '@tanstack/svelte-db'
import type { PromptFolder } from '@shared/domain/prompt-folder/PromptFolder'
import { revisionCollectionOptions } from './RevisionCollection'

export const promptFolderCollection = createCollection(
  revisionCollectionOptions<PromptFolder>({
    id: 'prompt-folders',
    getKey: (promptFolder) => promptFolder.id
  })
)
