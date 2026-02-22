import { createCollection, localOnlyCollectionOptions } from '@tanstack/svelte-db'

export const USER_PERSISTENCE_DRAFT_ID = 'user-persistence-draft'

export type UserPersistenceDraftRecord = {
  id: typeof USER_PERSISTENCE_DRAFT_ID
  lastWorkspacePath: string | null
}

// Local-only draft state for user persistence fields before sync writes.
export const userPersistenceDraftCollection = createCollection(
  localOnlyCollectionOptions<UserPersistenceDraftRecord>({
    id: 'user-persistence-drafts',
    getKey: (draft) => draft.id
  })
)
