import { createCollection, localOnlyCollectionOptions } from '@tanstack/svelte-db'

/** Session-only edit marker, independent of the note's owner. */
export type NoteClientState = {
  /** Stable note identity. */
  id: string
  /** Remains set after saving until the workspace session ends. */
  isEdited: boolean
}

/** Notes receive a marker on their first edit, with transactional rollback. */
export const noteClientStateCollection = createCollection(
  localOnlyCollectionOptions<NoteClientState>({
    id: 'note-client-state',
    getKey: (state) => state.id
  })
)
