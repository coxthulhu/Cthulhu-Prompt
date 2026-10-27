import { createAttachedNoteUiStateKey, type AttachedNoteUiState } from '@shared/domain/ui-state/AttachedNoteUiState'
import type { RevisionEnvelope } from '@shared/ipc/Revision'
import { data } from '../Data/Data'

/** Hydrates saved visibility for attached notes, including finalized owners. */
export const loadAttachedNoteUiStates = async (workspaceId: string, noteIds: string[]): Promise<RevisionEnvelope<AttachedNoteUiState>[]> => {
  /** Only attached records can have meaningful visibility. */
  const ids = noteIds.filter((id) => data.note.committedStore.getEntry(id)?.committed.kind === 'attached')
    .map((id) => createAttachedNoteUiStateKey(workspaceId, id))
  await Promise.all(ids.filter((id) => !data.attachedNoteUiState.committedStore.getEntry(id))
    .map((id) => data.attachedNoteUiState.loadDataFromPersistence(id, {})))
  return ids.flatMap((id) => {
    /** Absent preferences use the hidden default without creating a SQLite row. */
    const entry = data.attachedNoteUiState.committedStore.getEntry(id)
    return entry ? [{ id, revision: entry.revision, data: entry.committed }] : []
  })
}
