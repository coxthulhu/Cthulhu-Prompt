export type VersionedSnapshot<T> = {
  data: T
  version: number
}

export type VersionedSaveOutcome = 'idle' | 'saved' | 'conflict' | 'unchanged' | 'error'

export type VersionedSaveResult<TData> =
  | { type: 'saved'; snapshot: VersionedSnapshot<TData> }
  | { type: 'conflict'; snapshot: VersionedSnapshot<TData> }
  | { type: 'unchanged' }
  | { type: 'error'; message: string }

export type VersionedDataState<TDraft, TData> = {
  base: VersionedSnapshot<TData>
  draft: TDraft
  pending: VersionedSnapshot<TData> | null
  dirty: boolean
  isSaving: boolean
  errorMessage: string | null
  saveOutcome: VersionedSaveOutcome
  draftRevision: number
  pendingDraftRevision: number | null
}

export const createVersionedDataState = <TDraft, TData>(
  base: VersionedSnapshot<TData>,
  draft: TDraft,
  isDraftDirty: (draft: TDraft, base: VersionedSnapshot<TData>) => boolean = () => false
): VersionedDataState<TDraft, TData> => ({
  base,
  draft,
  pending: null,
  dirty: isDraftDirty(draft, base),
  isSaving: false,
  errorMessage: null,
  saveOutcome: 'idle',
  draftRevision: 0,
  pendingDraftRevision: null
})

export const markDraftUpdated = <TDraft, TData>(
  state: VersionedDataState<TDraft, TData>,
  isDraftDirty: (draft: TDraft, base: VersionedSnapshot<TData>) => boolean
): void => {
  // Track draft changes so we can avoid overwriting user edits during saves.
  state.draftRevision += 1
  state.dirty = isDraftDirty(state.draft, state.base)
  state.saveOutcome = 'idle'
  state.errorMessage = null
}

export const beginSave = <TDraft, TData>(
  state: VersionedDataState<TDraft, TData>,
  pending: VersionedSnapshot<TData>
): void => {
  state.isSaving = true
  state.errorMessage = null
  state.saveOutcome = 'idle'
  state.pending = pending
  state.pendingDraftRevision = state.draftRevision
}

export const applySaveSuccess = <TDraft, TData>(
  state: VersionedDataState<TDraft, TData>,
  snapshot: VersionedSnapshot<TData>,
  createDraft: (snapshot: VersionedSnapshot<TData>) => TDraft,
  isDraftDirty: (draft: TDraft, base: VersionedSnapshot<TData>) => boolean
): void => {
  const shouldReplaceDraft = state.pendingDraftRevision === state.draftRevision

  state.base = snapshot
  state.pending = null
  state.pendingDraftRevision = null
  if (shouldReplaceDraft) {
    state.draft = createDraft(snapshot)
  }
  state.dirty = isDraftDirty(state.draft, state.base)
  state.isSaving = false
  state.saveOutcome = state.dirty ? 'unchanged' : 'saved'
}

export const applySaveConflict = <TDraft, TData>(
  state: VersionedDataState<TDraft, TData>,
  snapshot: VersionedSnapshot<TData>,
  createDraft: (snapshot: VersionedSnapshot<TData>) => TDraft,
  isDraftDirty: (draft: TDraft, base: VersionedSnapshot<TData>) => boolean
): void => {
  state.base = snapshot
  state.pending = null
  state.pendingDraftRevision = null
  state.draft = createDraft(snapshot)
  state.dirty = isDraftDirty(state.draft, state.base)
  state.isSaving = false
  state.saveOutcome = 'conflict'
}

export const applySaveUnchanged = <TDraft, TData>(
  state: VersionedDataState<TDraft, TData>
): void => {
  state.pending = null
  state.pendingDraftRevision = null
  state.isSaving = false
  state.saveOutcome = 'unchanged'
}

export const applySaveError = <TDraft, TData>(
  state: VersionedDataState<TDraft, TData>,
  errorMessage: string
): void => {
  state.errorMessage = errorMessage
  state.pending = null
  state.pendingDraftRevision = null
  state.isSaving = false
  state.saveOutcome = 'error'
}

export const saveVersionedData = async <TDraft, TData>(
  state: VersionedDataState<TDraft, TData>,
  pending: VersionedSnapshot<TData>,
  createDraft: (snapshot: VersionedSnapshot<TData>) => TDraft,
  isDraftDirty: (draft: TDraft, base: VersionedSnapshot<TData>) => boolean,
  save: () => Promise<VersionedSaveResult<TData>>
): Promise<void> => {
  beginSave(state, pending)

  try {
    const result = await save()

    if (result.type === 'saved') {
      applySaveSuccess(state, result.snapshot, createDraft, isDraftDirty)
      return
    }

    if (result.type === 'conflict') {
      applySaveConflict(state, result.snapshot, createDraft, isDraftDirty)
      return
    }

    if (result.type === 'error') {
      applySaveError(state, result.message)
      return
    }

    applySaveUnchanged(state)
  } catch (error) {
    applySaveError(state, error instanceof Error ? error.message : String(error))
    throw error
  }
}

export const applyServerSnapshotBase = <TDraft, TData>(
  state: VersionedDataState<TDraft, TData>,
  snapshot: VersionedSnapshot<TData>,
  isDraftDirty: (draft: TDraft, base: VersionedSnapshot<TData>) => boolean
): void => {
  state.base = snapshot
  state.pending = null
  state.pendingDraftRevision = null
  state.dirty = isDraftDirty(state.draft, state.base)
}

export const applyServerSnapshot = <TDraft, TData>(
  state: VersionedDataState<TDraft, TData>,
  snapshot: VersionedSnapshot<TData>,
  createDraft: (snapshot: VersionedSnapshot<TData>) => TDraft,
  isDraftDirty: (draft: TDraft, base: VersionedSnapshot<TData>) => boolean
): void => {
  applyServerSnapshotBase(state, snapshot, isDraftDirty)
  state.draft = createDraft(snapshot)
  state.dirty = isDraftDirty(state.draft, state.base)
}
