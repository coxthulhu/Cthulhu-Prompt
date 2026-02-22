import { createCollection } from '@tanstack/svelte-db'
import type { WorkspacePersistence } from '@shared/UserPersistence'
import { revisionCollectionOptions } from './RevisionCollection'

export const workspacePersistenceCollection = createCollection(
  revisionCollectionOptions<WorkspacePersistence>({
    id: 'workspace-persistence',
    getKey: (workspacePersistence) => workspacePersistence.workspaceId
  })
)
