import { planSetAttachedNoteVisible } from '@shared/domain/ui-state/AttachedNoteUiState'
import { compactGuid } from '@shared/utilities/compactGuid'
import { getCurrentIsoSecondTimestamp } from '@shared/utilities/isoTimestamp'
import type { PromptLocation } from '@shared/domain/prompt/Prompt'
import {
  planCreateAttachedNote, planUpdateNote, planDeleteNote, planDetachNote, planSetNoteLocation,
  type UpdateNoteCommand
} from '@shared/domain/note/NoteDomainMutations'
import { runImmediateRendererDomainMutation, mutatePacedRendererDomainMutation } from '@renderer/data/IpcFramework/RendererDomainMutation'

/** Sets one attachment's user-specific visibility without editing its Markdown. */
export const setAttachedNoteVisible = async (workspaceId: string, noteId: string, visible: boolean): Promise<void> => {
  await runImmediateRendererDomainMutation({
    mutation: { command: { workspaceId, noteId, visible }, plan: planSetAttachedNoteVisible },
    ipc: { channel: 'set-attached-note-visible' }, renderer: {}
  })
}

/** Creates one empty attachment and returns its stable GUID for a future editor. */
export const createAttachedNote = async (ownerKind: 'prompt' | 'template', ownerId: string): Promise<string> => {
  /** Identity is generated before optimistic planning and retained through IPC. */
  const noteId = compactGuid(crypto.randomUUID())
  await runImmediateRendererDomainMutation({
    mutation: { command: { ownerKind, ownerId, noteId, modifiedAt: getCurrentIsoSecondTimestamp() }, plan: planCreateAttachedNote },
    ipc: { channel: 'create-attached-note' }, renderer: {}
  })
  return noteId
}

/** Persists a complete note edit; title is supplied only for standalone title changes. */
export const updateNote = async (noteId: string, noteText: string, title?: string): Promise<void> => {
  await runImmediateRendererDomainMutation({
    mutation: { command: { noteId, noteText, ...(title !== undefined ? { title } : {}), modifiedAt: getCurrentIsoSecondTimestamp() }, plan: planUpdateNote },
    ipc: { channel: 'update-note' }, renderer: {}
  })
}

/** Debounces replacement note edits through the existing globally ordered autosave queue. */
export const mutatePacedNoteUpdate = (edit: Omit<UpdateNoteCommand, 'modifiedAt'>, debounceMs: number): void => {
  mutatePacedRendererDomainMutation({
    mutation: { command: { ...edit, modifiedAt: getCurrentIsoSecondTimestamp() }, plan: planUpdateNote },
    ipc: { channel: 'update-note' }, renderer: {},
    pacing: { target: { entityType: 'note', id: edit.noteId }, debounceMs }
  })
}

/** Deletes either note form, including its owner reference when attached. */
export const deleteNote = async (noteId: string): Promise<void> => {
  await runImmediateRendererDomainMutation({
    mutation: { command: { noteId, modifiedAt: getCurrentIsoSecondTimestamp() }, plan: planDeleteNote },
    ipc: { channel: 'delete-note' }, renderer: {}
  })
}

/** Converts an attachment into a standalone entry immediately after its owner. */
export const detachNote = async (noteId: string): Promise<void> => {
  await runImmediateRendererDomainMutation({
    mutation: { command: { noteId, modifiedAt: getCurrentIsoSecondTimestamp() }, plan: planDetachNote },
    ipc: { channel: 'detach-note' }, renderer: {}
  })
}

/** Changes a standalone note's collection, category, status, or predecessor. */
export const setNoteLocation = async (sourcePromptCollectionId: string, noteId: string, location: PromptLocation): Promise<void> => {
  await runImmediateRendererDomainMutation({
    mutation: { command: { sourcePromptCollectionId, noteId, location, modifiedAt: getCurrentIsoSecondTimestamp() }, plan: planSetNoteLocation },
    ipc: { channel: 'set-note-location' }, renderer: {}
  })
}
