import { createCollection, localOnlyCollectionOptions } from '@tanstack/svelte-db'
import type { TanstackWorkspaceRecord } from '@shared/tanstack/TanstackWorkspace'

export const tanstackWorkspaceCollection = createCollection(
  localOnlyCollectionOptions<TanstackWorkspaceRecord>({
    // Local-only scaffold while workspace data migration is in progress.
    id: 'tanstack-workspaces',
    getKey: (item) => item.id
  })
)
