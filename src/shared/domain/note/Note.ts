import type { DomainState } from '@shared/domain/DomainChanges'
import type { PromptContentStatus } from '@shared/domain/prompt/Prompt'
import type { PromptCollection } from '@shared/domain/prompt-collection/PromptCollection'
import { getMarkdownContentIds } from '@shared/domain/markdown-content/MarkdownContent'

/** Independently persisted text shared by both note forms. */
export type NoteBase = {
  /** Stable GUID retained during detachment. */
  id: string
  /** Markdown body, preserved verbatim. */
  noteText: string
  /** Filesystem modification time. */
  modifiedAt: string
}

/** Attachment metadata is supplied by its owning prompt or template. */
export type AttachedNote = NoteBase & { kind: 'attached' }

/** Detached collection entry with its own title and workflow metadata. */
export type StandaloneNote = NoteBase & {
  /** Distinguishes independently ordered notes. */
  kind: 'standalone'
  /** Explicit title, or empty when using the fallback. */
  title: string
  /** Generated title used when the explicit title is empty. */
  fallbackTitle: string
  /** Time of detachment. */
  createdAt: string
  /** Collection-owned category, absent for Uncategorized. */
  category?: string
  /** Workflow status accepted by the containing collection. */
  status: PromptContentStatus
  /** Time the note entered its current final status. */
  finalizedAt?: string
}

/** One authoritative note record. */
export type Note = AttachedNote | StandaloneNote

/** Default title assigned when an attachment becomes standalone. */
export const DEFAULT_NOTE_FALLBACK_TITLE = 'New Note'

/** Returns standalone identities across ordered and finalized folders. */
export const getStandaloneNoteIds = (collection: PromptCollection): string[] =>
  Object.values(collection.statusFolders).flatMap((layout) =>
    layout.ordering === 'category'
      ? layout.categoryOrder.categories.flatMap((group) =>
          group.entries.flatMap((entry) => entry.kind === 'note' ? [entry.id] : []))
      : layout.noteIds
  )

/** Returns standalone notes and attachments belonging to one collection. */
export const getCollectionNoteIds = (state: DomainState, collection: PromptCollection): string[] => [
  ...getStandaloneNoteIds(collection),
  ...getMarkdownContentIds(collection, collection.kind).flatMap((id) => {
    /** Owner reference is the sole source of attachment membership. */
    const owner = state.get(collection.kind === 'prompt' ? 'prompt' : 'promptTemplate', id)
    return owner?.attachedNoteId ? [owner.attachedNoteId] : []
  })
]

/** Resolves the prompt or template referencing an attached note. */
export const findNoteOwner = (state: DomainState, noteId: string) => {
  for (const entityType of ['prompt', 'promptTemplate'] as const) {
    /** Owner whose front matter references this note. */
    const owner = state.getAll(entityType).find((content) => content.attachedNoteId === noteId)
    if (owner) return { entityType, owner }
  }
  return undefined
}
