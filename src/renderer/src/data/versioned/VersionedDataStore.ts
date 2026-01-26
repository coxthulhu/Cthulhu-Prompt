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

export type VersionedDataStore<TDraft, TData> = {
  createState: (
    base: VersionedSnapshot<TData>
  ) => VersionedDataState<TDraft, TData>
  markDraftUpdated: (state: VersionedDataState<TDraft, TData>) => void
  saveVersionedData: (
    state: VersionedDataState<TDraft, TData>,
    pending: VersionedSnapshot<TData>,
    save: () => Promise<VersionedSaveResult<TData>>
  ) => Promise<VersionedSaveOutcome>
}

const createVersionedDataState = <TDraft, TData>(
  base: VersionedSnapshot<TData>,
  draft: TDraft,
  isDraftDirty: (draft: TDraft, base: VersionedSnapshot<TData>) => boolean
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

const markDraftUpdated = <TDraft, TData>(
  state: VersionedDataState<TDraft, TData>,
  isDraftDirty: (draft: TDraft, base: VersionedSnapshot<TData>) => boolean
): void => {
  // Track draft changes so we can avoid overwriting user edits during saves.
  state.draftRevision += 1
  state.dirty = isDraftDirty(state.draft, state.base)
  state.saveOutcome = 'idle'
  state.errorMessage = null
}

const clearPendingState = <TDraft, TData>(
  state: VersionedDataState<TDraft, TData>
): void => {
  state.pending = null
  state.pendingDraftRevision = null
  state.isSaving = false
}

const finishSave = <TDraft, TData>(
  state: VersionedDataState<TDraft, TData>,
  outcome: VersionedSaveOutcome,
  errorMessage: string | null = null
): VersionedSaveOutcome => {
  state.errorMessage = errorMessage
  state.saveOutcome = outcome
  clearPendingState(state)
  return outcome
}

const beginSave = <TDraft, TData>(
  state: VersionedDataState<TDraft, TData>,
  pending: VersionedSnapshot<TData>
): void => {
  state.isSaving = true
  state.errorMessage = null
  state.saveOutcome = 'idle'
  state.pending = pending
  state.pendingDraftRevision = state.draftRevision
}

const applySaveSuccess = <TDraft, TData>(
  state: VersionedDataState<TDraft, TData>,
  snapshot: VersionedSnapshot<TData>,
  createDraft: (snapshot: VersionedSnapshot<TData>) => TDraft,
  isDraftDirty: (draft: TDraft, base: VersionedSnapshot<TData>) => boolean
): VersionedSaveOutcome => {
  const shouldReplaceDraft = state.pendingDraftRevision === state.draftRevision

  state.base = snapshot
  if (shouldReplaceDraft) {
    state.draft = createDraft(snapshot)
  }
  state.dirty = isDraftDirty(state.draft, state.base)
  return finishSave(state, state.dirty ? 'unchanged' : 'saved')
}

const applySaveConflict = <TDraft, TData>(
  state: VersionedDataState<TDraft, TData>,
  snapshot: VersionedSnapshot<TData>,
  createDraft: (snapshot: VersionedSnapshot<TData>) => TDraft,
  isDraftDirty: (draft: TDraft, base: VersionedSnapshot<TData>) => boolean
): VersionedSaveOutcome => {
  state.base = snapshot
  state.draft = createDraft(snapshot)
  state.dirty = isDraftDirty(state.draft, state.base)
  return finishSave(state, 'conflict')
}

const applySaveUnchanged = <TDraft, TData>(
  state: VersionedDataState<TDraft, TData>
): VersionedSaveOutcome => {
  return finishSave(state, 'unchanged')
}

const applySaveError = <TDraft, TData>(
  state: VersionedDataState<TDraft, TData>,
  errorMessage: string
): VersionedSaveOutcome => {
  return finishSave(state, 'error', errorMessage)
}

const saveVersionedData = async <TDraft, TData>(
  state: VersionedDataState<TDraft, TData>,
  pending: VersionedSnapshot<TData>,
  createDraft: (snapshot: VersionedSnapshot<TData>) => TDraft,
  isDraftDirty: (draft: TDraft, base: VersionedSnapshot<TData>) => boolean,
  save: () => Promise<VersionedSaveResult<TData>>
): Promise<VersionedSaveOutcome> => {
  beginSave(state, pending)

  try {
    const result = await save()

    switch (result.type) {
      case 'saved':
        return applySaveSuccess(state, result.snapshot, createDraft, isDraftDirty)
      case 'conflict':
        return applySaveConflict(state, result.snapshot, createDraft, isDraftDirty)
      case 'error':
        return applySaveError(state, result.message)
      case 'unchanged':
        return applySaveUnchanged(state)
    }
  } catch (error) {
    applySaveError(state, error instanceof Error ? error.message : String(error))
    throw error
  }
}

export const createVersionedDataStore = <TDraft, TData>(params: {
  createDraft: (snapshot: VersionedSnapshot<TData>) => TDraft
  isDraftDirty: (draft: TDraft, base: VersionedSnapshot<TData>) => boolean
}): VersionedDataStore<TDraft, TData> => {
  const { createDraft, isDraftDirty } = params

  return {
    createState: (base) => {
      return createVersionedDataState(base, createDraft(base), isDraftDirty)
    },
    markDraftUpdated: (state) => {
      markDraftUpdated(state, isDraftDirty)
    },
    saveVersionedData: (state, pending, save) => {
      return saveVersionedData(state, pending, createDraft, isDraftDirty, save)
    }
  }
}
