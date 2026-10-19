import type { DomainChange, DomainPlanner, DomainState, DomainTarget } from '@shared/domain/DomainChanges'
import { deleteAttachedNoteUiState } from '@shared/domain/ui-state/AttachedNoteUiState'
import { getAllWorkspaceCollectionEntries } from '@shared/domain/workspace/Workspace'
import { getMarkdownContentIds, placeMarkdownContentInCategoryOrder } from '@shared/domain/markdown-content/MarkdownContent'
import { getPromptStatusFolderDefinition, isFinalPromptStatus, isPromptStatus, type PromptLocation } from '@shared/domain/prompt/Prompt'
import { isPromptTemplateStatus } from '@shared/domain/prompt-template/PromptTemplate'
import { removeCategoryOrderEntry } from '@shared/domain/prompt-collection/PromptCollection'
import { resolveAvailablePromptFallbackTitle, resolvePromptTitleUpdate } from '@shared/domain/prompt/promptFallbackTitle'
import { parseIsoSecondTimestamp } from '@shared/utilities/isoTimestamp'
import { DEFAULT_NOTE_FALLBACK_TITLE, findNoteOwner, getStandaloneNoteIds, type StandaloneNote } from './Note'

/** Renderer-generated identity and timestamp for a new empty attachment. */
export type CreateAttachedNoteCommand = {
  /** Owner entity collection. */
  ownerKind: 'prompt' | 'template'
  /** Prompt or template receiving its single attachment. */
  ownerId: string
  /** New stable GUID. */
  noteId: string
  /** Time of creation and owner relationship change. */
  modifiedAt: string
}

/** Identity and timestamp shared by delete and detach commands. */
export type NoteCommand = {
  /** Note selected by the operation. */
  noteId: string
  /** Timestamp for changed metadata. */
  modifiedAt: string
}

/** Replacement text, with an optional standalone title change. */
export type UpdateNoteCommand = NoteCommand & {
  /** Complete Markdown body. */
  noteText: string
  /** Omitted for text-only edits and required to remain absent on attachments. */
  title?: string
}

/** Complete standalone destination, including category and manual predecessor. */
export type SetNoteLocationCommand = NoteCommand & {
  /** Claimed source used to reject stale ownership. */
  sourcePromptCollectionId: string
  /** Destination constrained to the source library's workflow. */
  location: PromptLocation
}

/** Checks the exact primitive fields common to note commands. */
const commandRecord = (value: unknown, fields: string[]): Record<string, unknown> | null => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  /** Raw fields checked before crossing the IPC boundary. */
  const record = value as Record<string, unknown>
  if (Object.keys(record).length !== fields.length || fields.some((field) => !(field in record)) ||
    typeof record.noteId !== 'string' || parseIsoSecondTimestamp(record.modifiedAt) === null) return null
  return record
}

/** Parses the exact new-attachment request. */
export const parseCreateAttachedNoteCommand = (value: unknown): CreateAttachedNoteCommand | null => {
  /** Validated command field set. */
  const record = commandRecord(value, ['ownerKind', 'ownerId', 'noteId', 'modifiedAt'])
  return record && (record.ownerKind === 'prompt' || record.ownerKind === 'template') && typeof record.ownerId === 'string'
    ? record as CreateAttachedNoteCommand : null
}

/** Parses the exact detach/delete request. */
export const parseNoteCommand = (value: unknown): NoteCommand | null =>
  commandRecord(value, ['noteId', 'modifiedAt']) as NoteCommand | null

/** Parses note edits without accepting placement or owner metadata. */
export const parseUpdateNoteCommand = (value: unknown): UpdateNoteCommand | null => {
  /** Title is an explicitly optional edit, not a required redundant attachment field. */
  const hasTitle = !!value && typeof value === 'object' && 'title' in value
  /** Validated set-style edit fields. */
  const record = commandRecord(value, ['noteId', 'modifiedAt', 'noteText', ...(hasTitle ? ['title'] : [])])
  return record && typeof record.noteText === 'string' && (!hasTitle || typeof record.title === 'string')
    ? record as UpdateNoteCommand : null
}

/** Parses standalone movement with exact nested placement fields. */
export const parseSetNoteLocationCommand = (value: unknown): SetNoteLocationCommand | null => {
  /** Top-level fields validated before inspecting placement. */
  const record = commandRecord(value, ['noteId', 'modifiedAt', 'sourcePromptCollectionId', 'location'])
  if (!record || typeof record.sourcePromptCollectionId !== 'string' || !record.location || typeof record.location !== 'object') return null
  /** Nested location shares the existing prompt/template placement contract. */
  const location = record.location as Record<string, unknown>
  if (Object.keys(location).length !== 4 || typeof location.promptCollectionId !== 'string' ||
    (location.categoryId !== null && typeof location.categoryId !== 'string') ||
    (location.previousEntryId !== null && typeof location.previousEntryId !== 'string') ||
    (!isPromptStatus(location.status) && !isPromptTemplateStatus(location.status)) ||
    (isFinalPromptStatus(location.status) && location.previousEntryId !== null)) return null
  return record as SetNoteLocationCommand
}

/** Finds the collection owning a standalone note or an attachment's owner. */
const findCollection = (state: DomainState, noteId: string) => {
  /** Attached owner, when the note has not been detached. */
  const attachment = findNoteOwner(state, noteId)
  return state.getAll('promptCollection').find((collection) => attachment
    ? getMarkdownContentIds(collection, collection.kind).includes(attachment.owner.id)
    : getStandaloneNoteIds(collection).includes(noteId))
}

/** Resolves the workspace key for attachment-state cleanup during detach or deletion. */
const clearAttachedNoteUiState = (state: DomainState, collectionId: string, noteId: string): DomainChange => {
  /** Every loaded collection belongs to one loaded workspace. */
  const workspace = state.getAll('workspace').find((candidate) =>
    getAllWorkspaceCollectionEntries(candidate).some((entry) => entry.id === collectionId))!
  return deleteAttachedNoteUiState(workspace.id, noteId)
}

/** Finds sibling standalone titles in one physical status folder. */
const siblingNotes = (state: DomainState, collectionId: string, status: StandaloneNote['status']): StandaloneNote[] => {
  /** Collection whose notes share the fallback-title namespace. */
  const collection = state.get('promptCollection', collectionId)!
  return getStandaloneNoteIds(collection).flatMap((id) => {
    /** Only standalone notes in the same physical folder compete for fallback titles. */
    const note = state.get('note', id)
    return note?.kind === 'standalone' && getPromptStatusFolderDefinition(note.status).id === getPromptStatusFolderDefinition(status).id ? [note] : []
  })
}

/** Creates an empty note and the owner's relationship atomically, including finalized owners. */
export const planCreateAttachedNote: DomainPlanner<CreateAttachedNoteCommand> = (state, command) => {
  /** Entity type selected by the validated owner kind. */
  const entityType = command.ownerKind === 'prompt' ? 'prompt' : 'promptTemplate'
  /** Owner must exist and have no current attachment. */
  const owner = state.get(entityType, command.ownerId)
  /** Required targets reconcile stale creation attempts. */
  const targets: DomainTarget[] = [{ entityType, id: command.ownerId }, { entityType: 'note', id: command.noteId }]
  if (!owner || owner.attachedNoteId || state.get('note', command.noteId)) return { status: 'conflict', reason: 'Note attachment conflict', targets }
  return [
    { type: 'update', entityType, id: owner.id, recipe: (draft) => {
      draft.attachedNoteId = command.noteId
      draft.modifiedAt = command.modifiedAt
    } } as DomainChange,
    { type: 'insert', entityType: 'note', id: command.noteId, data: {
      id: command.noteId, kind: 'attached', noteText: '', modifiedAt: command.modifiedAt
    } }
  ]
}

/** Edits only the note, preserving owner timestamps and standalone ordering metadata. */
export const planUpdateNote: DomainPlanner<UpdateNoteCommand> = (state, command) => {
  /** Existing authoritative note. */
  const note = state.get('note', command.noteId)
  /** Stable target reconciled after an invalid edit. */
  const targets: DomainTarget[] = [{ entityType: 'note', id: command.noteId }]
  if (!note || (note.kind === 'attached' && command.title !== undefined)) return { status: 'conflict', reason: 'Note edit conflict', targets }
  /** Standalone title changes reuse the prompt fallback-title rules. */
  const title = note.kind === 'standalone' && command.title !== undefined
    ? resolvePromptTitleUpdate({ prompts: siblingNotes(state, findCollection(state, note.id)!.id, note.status), promptId: note.id,
        currentTitle: note.title, currentFallbackTitle: note.fallbackTitle, nextTitle: command.title, defaultFallbackTitle: DEFAULT_NOTE_FALLBACK_TITLE })
    : undefined
  return [{ type: 'update', entityType: 'note', id: note.id, recipe: (draft) => {
    draft.noteText = command.noteText
    draft.modifiedAt = command.modifiedAt
    if (title) Object.assign(draft, title)
  } }]
}

/** Removes the owner relationship and records its modified time. */
const clearAttachment = (attachment: NonNullable<ReturnType<typeof findNoteOwner>>, modifiedAt: string): DomainChange => ({
  type: 'update', entityType: attachment.entityType, id: attachment.owner.id,
  recipe: (draft) => { delete draft.attachedNoteId; draft.modifiedAt = modifiedAt }
} as DomainChange)

/** Detaches once, retaining identity/text and inserting immediately after the active owner. */
export const planDetachNote: DomainPlanner<NoteCommand> = (state, command) => {
  /** Current note and its referencing owner. */
  const note = state.get('note', command.noteId)
  /** Relationship is authoritative even when filenames have changed. */
  const attachment = findNoteOwner(state, command.noteId)
  /** Containing collection supplies workflow and ordering rules. */
  const collection = findCollection(state, command.noteId)
  /** Conflict targets restore the relevant owner and collection together. */
  const targets: DomainTarget[] = [{ entityType: 'note', id: command.noteId },
    ...(attachment ? [{ entityType: attachment.entityType, id: attachment.owner.id }] : []),
    ...(collection ? [{ entityType: 'promptCollection' as const, id: collection.id }] : [])]
  if (note?.kind !== 'attached' || !attachment || !collection) return { status: 'conflict', reason: 'Note detachment conflict', targets }
  /** Existing owner status; templates loaded from disk normalize Active explicitly. */
  const status = attachment.owner.status!
  if (isFinalPromptStatus(status)) return { status: 'conflict', reason: 'Cannot detach a finalized owner note', targets }
  /** Ordered folder in which the owner currently appears. */
  const folder = getPromptStatusFolderDefinition(status)
  /** Standalone metadata begins at detachment rather than attachment creation. */
  const standalone: StandaloneNote = {
    id: note.id, kind: 'standalone', noteText: note.noteText, modifiedAt: command.modifiedAt,
    title: '', fallbackTitle: resolveAvailablePromptFallbackTitle(siblingNotes(state, collection.id, status), note.id, DEFAULT_NOTE_FALLBACK_TITLE),
    createdAt: command.modifiedAt, status,
    ...(attachment.owner.category ? { category: attachment.owner.category } : {})
  }
  return [clearAttachment(attachment, command.modifiedAt),
    clearAttachedNoteUiState(state, collection.id, note.id),
    { type: 'update', entityType: 'note', id: note.id, recipe: (draft) => { Object.assign(draft, standalone) } },
    { type: 'update', entityType: 'promptCollection', id: collection.id, recipe: (draft) => {
      /** Ordered layout guaranteed by the final-status guard. */
      const layout = draft.statusFolders[folder.id]
      if (layout.ordering === 'category') layout.categoryOrder = placeMarkdownContentInCategoryOrder(
        layout.categoryOrder, standalone, { kind: 'note', id: note.id }, standalone.category ?? null, attachment.owner.id).categoryOrder
    } }
  ]
}

/** Deletes either note form, clearing only the relevant relationship or ordered reference. */
export const planDeleteNote: DomainPlanner<NoteCommand> = (state, command) => {
  /** Note whose ownership determines the accompanying update. */
  const note = state.get('note', command.noteId)
  /** Containing collection, including attachment-derived ownership. */
  const collection = findCollection(state, command.noteId)
  if (!note || !collection) return { status: 'conflict', reason: 'Note deletion conflict', targets: [{ entityType: 'note', id: command.noteId }] }
  /** Atomic relationship/order cleanup followed by file removal. */
  const changes: DomainChange[] = note.kind === 'attached'
    ? [clearAttachment(findNoteOwner(state, note.id)!, command.modifiedAt), clearAttachedNoteUiState(state, collection.id, note.id)]
    : [{ type: 'update', entityType: 'promptCollection', id: collection.id, recipe: (draft) => {
        for (const layout of Object.values(draft.statusFolders)) {
          if (layout.ordering === 'category') layout.categoryOrder = removeCategoryOrderEntry(layout.categoryOrder, { kind: 'note', id: note.id })
          else layout.noteIds = layout.noteIds.filter((id) => id !== note.id)
        }
      } }]
  changes.push({ type: 'delete', entityType: 'note', id: note.id })
  return changes
}

/** Moves/reorders standalone notes while enforcing collection-kind and workflow boundaries. */
export const planSetNoteLocation: DomainPlanner<SetNoteLocationCommand> = (state, command) => {
  /** Standalone note selected by the command. */
  const note = state.get('note', command.noteId)
  /** Actual ownership takes precedence over the renderer's claimed source. */
  const source = findCollection(state, command.noteId)
  /** Destination collection and complete requested placement. */
  const destination = state.get('promptCollection', command.location.promptCollectionId)
  /** Shared destination fields. */
  const location = command.location
  /** Distinct collection targets used for placement conflicts. */
  const targets: DomainTarget[] = [{ entityType: 'note', id: command.noteId },
    ...[...new Set([source?.id ?? command.sourcePromptCollectionId, location.promptCollectionId])].map((id) => ({ entityType: 'promptCollection' as const, id }))]
  if (note?.kind !== 'standalone' || !source || !destination || source.id !== command.sourcePromptCollectionId || source.kind !== destination.kind ||
    !(source.kind === 'prompt' ? isPromptStatus(location.status) : isPromptTemplateStatus(location.status))) {
    return { status: 'conflict', reason: 'Note location ownership conflict', targets }
  }
  /** Physical source and destination folders control manual versus automatic ordering. */
  const sourceFolder = getPromptStatusFolderDefinition(note.status)
  /** Destination workflow definition. */
  const targetFolder = getPromptStatusFolderDefinition(location.status)
  /** Target layout used to validate the requested predecessor. */
  const targetLayout = destination.statusFolders[targetFolder.id]
  /** Stable ordered identity used in removal and insertion. */
  const entry = { kind: 'note' as const, id: note.id }
  try {
    /** Manual insertion is validated before returning any changes. */
    const placement = targetLayout.ordering === 'category'
      ? placeMarkdownContentInCategoryOrder(targetLayout.categoryOrder, note, entry, location.categoryId, location.previousEntryId)
      : null
    if (targetLayout.ordering === 'finalizedAt' && location.previousEntryId !== null) throw new Error('Finalized ordering is automatic')
    /** One collection update per owner, even when transferring between its folders. */
    const changes: DomainChange[] = [...new Set([source.id, destination.id])].map((id) => ({
      type: 'update', entityType: 'promptCollection', id, recipe: (draft) => {
        if (id === source.id) {
          /** Source layout loses the old reference. */
          const layout = draft.statusFolders[sourceFolder.id]
          if (layout.ordering === 'category') layout.categoryOrder = removeCategoryOrderEntry(layout.categoryOrder, entry)
          else layout.noteIds = layout.noteIds.filter((id) => id !== note.id)
        }
        if (id === destination.id) {
          /** Destination receives the validated reference once. */
          const layout = draft.statusFolders[targetFolder.id]
          if (layout.ordering === 'category') layout.categoryOrder = placement!.categoryOrder
          else layout.noteIds = [note.id, ...layout.noteIds.filter((id) => id !== note.id)]
        }
      }
    }))
    changes.push({ type: 'update', entityType: 'note', id: note.id, recipe: (draft) => {
      if (draft.kind !== 'standalone') return
      if (note.status !== location.status) draft.modifiedAt = command.modifiedAt
      draft.status = location.status
      if (location.categoryId === null) delete draft.category
      else draft.category = location.categoryId
      if (targetFolder.isFinal) draft.finalizedAt = note.status === location.status && note.finalizedAt ? note.finalizedAt : command.modifiedAt
      else delete draft.finalizedAt
      if (source.id !== destination.id && !note.title.trim()) draft.fallbackTitle = resolveAvailablePromptFallbackTitle(
        siblingNotes(state, destination.id, location.status), note.id, note.fallbackTitle)
    } })
    return changes
  } catch {
    return { status: 'conflict', reason: 'Note placement conflict', targets }
  }
}
