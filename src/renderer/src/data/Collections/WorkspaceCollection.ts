import { createCollection } from '@tanstack/svelte-db'
import type { Workspace } from '@shared/Workspace'
import { revisionCollectionOptions } from './RevisionCollection'

export const workspaceCollection = createCollection(
  revisionCollectionOptions<Workspace>({
    id: 'workspaces',
    getKey: (workspace) => workspace.id
  })
)
