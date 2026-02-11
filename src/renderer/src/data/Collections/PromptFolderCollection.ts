import { createCollection } from '@tanstack/svelte-db'
import type { PromptFolder } from '@shared/PromptFolder'
import { revisionCollectionOptions } from './RevisionCollection'

export const promptFolderCollection = createCollection(
  revisionCollectionOptions<PromptFolder>({
    id: 'prompt-folders',
    getKey: (promptFolder) => promptFolder.id
  })
)
