import { createCollection, localOnlyCollectionOptions } from '@tanstack/svelte-db'
import type { TanstackPromptFolderRecord } from '@shared/tanstack/TanstackPromptFolder'

export const tanstackPromptFolderCollection = createCollection(
  localOnlyCollectionOptions<TanstackPromptFolderRecord>({
    // Local-only scaffold while prompt folder data migration is in progress.
    id: 'tanstack-prompt-folders',
    getKey: (item) => item.id
  })
)
