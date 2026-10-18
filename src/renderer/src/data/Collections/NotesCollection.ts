import { createCollection } from '@tanstack/svelte-db'
import type { Note } from '@shared/domain/note/Note'
import { revisionCollectionOptions } from './RevisionCollection'

/** Authoritative notes available to future note editors. */
export const notesCollection = createCollection(
  revisionCollectionOptions<Note>({ id: 'notes', getKey: (note) => note.id })
)
