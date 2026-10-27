import type { DomainChange, DomainPlanner, DomainTarget } from '@shared/domain/DomainChanges'
import { findNoteOwner } from '@shared/domain/note/Note'
import { getMarkdownContentIds } from '@shared/domain/markdown-content/MarkdownContent'
import { getAllWorkspaceCollectionEntries } from '@shared/domain/workspace/Workspace'

/** User-specific visibility for one attachment; absence means hidden. */
export type AttachedNoteUiState = {
  /** Workspace owning the attachment. */
  workspaceId: string
  /** Attached note whose visibility is remembered. */
  noteId: string
  /** Whether the attached-note editor should be shown. */
  visible: boolean
}

/** Builds the workspace-scoped identity used by SQLite and revision collections. */
export const createAttachedNoteUiStateKey = (workspaceId: string, noteId: string): string =>
  `${workspaceId}:${noteId}`

/** Parses the complete visibility command without accepting content changes. */
export const parseSetAttachedNoteVisibleCommand = (value: unknown): AttachedNoteUiState | null => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  /** Primitive fields checked at the IPC boundary. */
  const record = value as Record<string, unknown>
  return Object.keys(record).length === 3 && typeof record.workspaceId === 'string' &&
    typeof record.noteId === 'string' && typeof record.visible === 'boolean'
    ? record as AttachedNoteUiState : null
}

/** Changes only user state after validating attachment and workspace ownership. */
export const planSetAttachedNoteVisible: DomainPlanner<AttachedNoteUiState> = (state, command) => {
  /** Preference identity remains independent of filenames and collection moves. */
  const id = createAttachedNoteUiStateKey(command.workspaceId, command.noteId)
  /** Current attachment and its referencing prompt or template. */
  const note = state.get('note', command.noteId)
  /** Owner reference determines membership in the requested workspace. */
  const attachment = findNoteOwner(state, command.noteId)
  /** Requested workspace supplies the authoritative collection membership. */
  const workspace = state.get('workspace', command.workspaceId)
  /** Conflict snapshots reconcile both note kind and saved visibility. */
  const targets: DomainTarget[] = [
    { entityType: 'note', id: command.noteId },
    { entityType: 'attachedNoteUiState', id }
  ]
  if (note?.kind !== 'attached' || !attachment || !workspace ||
    !getAllWorkspaceCollectionEntries(workspace).some((entry) => {
      /** Collection containing the attachment's owner. */
      const collection = state.get('promptCollection', entry.id)
      return collection && getMarkdownContentIds(collection, collection.kind).includes(attachment.owner.id)
    })) return { status: 'conflict', reason: 'Attached note visibility conflict', targets }
  return state.get('attachedNoteUiState', id)
    ? [{ type: 'update', entityType: 'attachedNoteUiState', id, recipe: (draft) => { draft.visible = command.visible } }]
    : [{ type: 'insert', entityType: 'attachedNoteUiState', id, data: command }]
}

/** Removes optional visibility in the same transaction as its attachment lifecycle change. */
export const deleteAttachedNoteUiState = (workspaceId: string, noteId: string): DomainChange => ({
  type: 'delete', entityType: 'attachedNoteUiState', id: createAttachedNoteUiStateKey(workspaceId, noteId)
})
