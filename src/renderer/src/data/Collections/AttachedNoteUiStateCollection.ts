import { createCollection } from '@tanstack/svelte-db'
import { createAttachedNoteUiStateKey, type AttachedNoteUiState } from '@shared/domain/ui-state/AttachedNoteUiState'
import { revisionCollectionOptions } from './RevisionCollection'
import { notesCollection } from './NotesCollection'

/** Independently persisted attachment visibility, defaulting to hidden when absent. */
export const attachedNoteUiStateCollection = createCollection(
  revisionCollectionOptions<AttachedNoteUiState>({
    id: 'attached-note-ui-state',
    getKey: (state) => createAttachedNoteUiStateKey(state.workspaceId, state.noteId),
    targetPolicy: 'deleteIfPresent'
  })
)

/** Reads visibility for actions; standalone and missing notes have no visibility setting. */
export const getAttachedNoteVisible = (workspaceId: string, noteId: string): boolean | undefined =>
  notesCollection.get(noteId)?.kind === 'attached'
    ? attachedNoteUiStateCollection.get(createAttachedNoteUiStateKey(workspaceId, noteId))?.visible ?? false
    : undefined
