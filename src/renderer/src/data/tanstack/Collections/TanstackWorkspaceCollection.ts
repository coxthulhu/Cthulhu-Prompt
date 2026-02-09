import { createCollection } from '@tanstack/svelte-db'
import type { TanstackWorkspace } from '@shared/tanstack/TanstackWorkspace'
import { tanstackRevisionCollectionOptions } from './TanstackRevisionCollection'

export const tanstackWorkspaceCollection = createCollection(
  tanstackRevisionCollectionOptions<TanstackWorkspace>({
    id: 'tanstack-workspaces',
    getKey: (workspace) => workspace.id
  })
)
