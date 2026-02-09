import { createCollection } from '@tanstack/svelte-db'
import type { TanstackPromptFolder } from '@shared/tanstack/TanstackPromptFolder'
import { tanstackRevisionCollectionOptions } from './TanstackRevisionCollection'

export const tanstackPromptFolderCollection = createCollection(
  tanstackRevisionCollectionOptions<TanstackPromptFolder>({
    id: 'tanstack-prompt-folders',
    getKey: (promptFolder) => promptFolder.id
  })
)
