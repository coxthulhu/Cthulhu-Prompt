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

export type VersionedSaveResponse<TData> = {
  success: boolean
  conflict?: boolean
  data?: TData
  version?: number
  error?: string
}

export type VersionedDataState<TDraft, TData> = {
  baseSnapshot: VersionedSnapshot<TData>
  draftSnapshot: TDraft
  savingSnapshot: VersionedSnapshot<TData> | null
  dirty: boolean
  isSaving: boolean
  errorMessage: string | null
  saveOutcome: VersionedSaveOutcome
  draftRevision: number
  draftRevisionAtSave: number | null
}

export type VersionedDataStore<TDraft, TData> = {
  createState: (
    base: VersionedSnapshot<TData>
  ) => VersionedDataState<TDraft, TData>
  markDraftChanged: (state: VersionedDataState<TDraft, TData>) => void
  saveVersionedData: (
    state: VersionedDataState<TDraft, TData>,
    savingSnapshot: VersionedSnapshot<TData>,
    save: () => Promise<VersionedSaveResult<TData>>
  ) => Promise<VersionedSaveOutcome>
}

export const toVersionedSaveResult = <TData>(
  result: VersionedSaveResponse<TData>,
  createSnapshot: (data: TData, version: number) => VersionedSnapshot<TData>
): VersionedSaveResult<TData> => {
  if (result.success) {
    return {
      type: 'saved',
      snapshot: createSnapshot(result.data as TData, result.version as number)
    }
  }

  if (result.conflict) {
    return {
      type: 'conflict',
      snapshot: createSnapshot(result.data as TData, result.version as number)
    }
  }

  return { type: 'error', message: (result as { error: string }).error }
}

const createVersionedDataState = <TDraft, TData>(
  base: VersionedSnapshot<TData>,
  draft: TDraft,
  isDraftDirty: (draft: TDraft, base: VersionedSnapshot<TData>) => boolean
): VersionedDataState<TDraft, TData> => ({
  baseSnapshot: base,
  draftSnapshot: draft,
  savingSnapshot: null,
  dirty: isDraftDirty(draft, base),
  isSaving: false,
  errorMessage: null,
  saveOutcome: 'idle',
  draftRevision: 0,
  draftRevisionAtSave: null
})

const markDraftChanged = <TDraft, TData>(
  state: VersionedDataState<TDraft, TData>,
  isDraftDirty: (draft: TDraft, base: VersionedSnapshot<TData>) => boolean
): void => {
  // Track draft changes so we can avoid overwriting user edits during saves.
  state.draftRevision += 1
  state.dirty = isDraftDirty(state.draftSnapshot, state.baseSnapshot)
  state.saveOutcome = 'idle'
  state.errorMessage = null
}

const beginSave = <TDraft, TData>(
  state: VersionedDataState<TDraft, TData>,
  savingSnapshot: VersionedSnapshot<TData>
): void => {
  state.isSaving = true
  state.errorMessage = null
  state.saveOutcome = 'idle'
  state.savingSnapshot = savingSnapshot
  state.draftRevisionAtSave = state.draftRevision
}

const finishSave = <TDraft, TData>(
  state: VersionedDataState<TDraft, TData>,
  outcome: VersionedSaveOutcome,
  errorMessage: string | null = null
): VersionedSaveOutcome => {
  state.errorMessage = errorMessage
  state.saveOutcome = outcome
  state.savingSnapshot = null
  state.draftRevisionAtSave = null
  state.isSaving = false
  return outcome
}

const applyServerSnapshot = <TDraft, TData>(
  state: VersionedDataState<TDraft, TData>,
  snapshot: VersionedSnapshot<TData>,
  createDraft: (snapshot: VersionedSnapshot<TData>) => TDraft,
  isDraftDirty: (draft: TDraft, base: VersionedSnapshot<TData>) => boolean,
  replaceDraft: boolean
): void => {
  state.baseSnapshot = snapshot
  if (replaceDraft) {
    state.draftSnapshot = createDraft(snapshot)
  }
  state.dirty = isDraftDirty(state.draftSnapshot, state.baseSnapshot)
}

const applySaveSuccess = <TDraft, TData>(
  state: VersionedDataState<TDraft, TData>,
  snapshot: VersionedSnapshot<TData>,
  createDraft: (snapshot: VersionedSnapshot<TData>) => TDraft,
  isDraftDirty: (draft: TDraft, base: VersionedSnapshot<TData>) => boolean
): VersionedSaveOutcome => {
  const shouldReplaceDraft = state.draftRevisionAtSave === state.draftRevision
  applyServerSnapshot(state, snapshot, createDraft, isDraftDirty, shouldReplaceDraft)
  return finishSave(state, state.dirty ? 'unchanged' : 'saved')
}

const applySaveConflict = <TDraft, TData>(
  state: VersionedDataState<TDraft, TData>,
  snapshot: VersionedSnapshot<TData>,
  createDraft: (snapshot: VersionedSnapshot<TData>) => TDraft,
  isDraftDirty: (draft: TDraft, base: VersionedSnapshot<TData>) => boolean
): VersionedSaveOutcome => {
  applyServerSnapshot(state, snapshot, createDraft, isDraftDirty, true)
  return finishSave(state, 'conflict')
}

const saveVersionedData = async <TDraft, TData>(
  state: VersionedDataState<TDraft, TData>,
  savingSnapshot: VersionedSnapshot<TData>,
  createDraft: (snapshot: VersionedSnapshot<TData>) => TDraft,
  isDraftDirty: (draft: TDraft, base: VersionedSnapshot<TData>) => boolean,
  save: () => Promise<VersionedSaveResult<TData>>
): Promise<VersionedSaveOutcome> => {
  beginSave(state, savingSnapshot)

  try {
    const result = await save()

    switch (result.type) {
      case 'saved':
        return applySaveSuccess(state, result.snapshot, createDraft, isDraftDirty)
      case 'conflict':
        return applySaveConflict(state, result.snapshot, createDraft, isDraftDirty)
      case 'error':
        return finishSave(state, 'error', result.message)
      case 'unchanged':
        return finishSave(state, 'unchanged')
    }
  } catch (error) {
    finishSave(state, 'error', error instanceof Error ? error.message : String(error))
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
    markDraftChanged: (state) => {
      markDraftChanged(state, isDraftDirty)
    },
    saveVersionedData: (state, savingSnapshot, save) => {
      return saveVersionedData(state, savingSnapshot, createDraft, isDraftDirty, save)
    }
  }
}
