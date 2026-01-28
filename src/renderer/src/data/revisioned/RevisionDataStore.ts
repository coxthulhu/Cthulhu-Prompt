export type RevisionSnapshot<T> = {
  data: T
  revision: number
}

export type RevisionSaveOutcome = 'idle' | 'saved' | 'conflict' | 'unchanged' | 'error'

export type RevisionDataState<TDraft, TData> = {
  baseSnapshot: RevisionSnapshot<TData>
  draftSnapshot: TDraft
  isSaving: boolean
  isLoading: boolean
  loadRequestId: number
  saveError: string | null
  draftRevision: number
  draftRevisionAtSave: number | null
}

export type RevisionLoadResult<TDraft, TData> =
  | { type: 'loaded'; state: RevisionDataState<TDraft, TData> }
  | { type: 'error'; message: string }
  | { type: 'stale' }

export type RevisionDataStoreBase<TDraft, TData> = {
  createState: (
    base: RevisionSnapshot<TData>
  ) => RevisionDataState<TDraft, TData>
  markDraftChanged: (state: RevisionDataState<TDraft, TData>) => void
  beginSave: (state: RevisionDataState<TDraft, TData>) => void
  applySaveSuccess: (
    state: RevisionDataState<TDraft, TData>,
    snapshot: RevisionSnapshot<TData>
  ) => RevisionSaveOutcome
  applySaveConflict: (
    state: RevisionDataState<TDraft, TData>,
    snapshot: RevisionSnapshot<TData>
  ) => RevisionSaveOutcome
  applySaveError: (state: RevisionDataState<TDraft, TData>, message: string) => RevisionSaveOutcome
}

export type RevisionDataStoreWithLoad<
  TDraft,
  TData,
  TLoadSuccess extends object
> = RevisionDataStoreBase<TDraft, TData> & {
  beginLoad: (state: RevisionDataState<TDraft, TData>) => number
  createSnapshotFromLoad: (result: TLoadSuccess) => RevisionSnapshot<TData>
  applyLoadSuccess: (
    state: RevisionDataState<TDraft, TData>,
    snapshot: RevisionSnapshot<TData>
  ) => RevisionDataState<TDraft, TData>
  applyLoadError: (
    state: RevisionDataState<TDraft, TData>,
    message: string
  ) => RevisionLoadResult<TDraft, TData>
  applyLoadStale: (state: RevisionDataState<TDraft, TData>) => void
}

const createRevisionDataState = <TDraft, TData>(
  base: RevisionSnapshot<TData>,
  draft: TDraft
): RevisionDataState<TDraft, TData> => ({
  baseSnapshot: base,
  draftSnapshot: draft,
  isSaving: false,
  isLoading: false,
  loadRequestId: 0,
  saveError: null,
  draftRevision: 0,
  draftRevisionAtSave: null
})

const markDraftChanged = <TDraft, TData>(state: RevisionDataState<TDraft, TData>): void => {
  // Track draft changes so we can avoid overwriting user edits during saves.
  state.draftRevision += 1
  state.saveError = null
}

const beginLoad = <TDraft, TData>(state: RevisionDataState<TDraft, TData>): number => {
  const loadRequestId = state.loadRequestId + 1
  state.loadRequestId = loadRequestId
  state.isLoading = true
  return loadRequestId
}

const applyLoadSuccess = <TDraft, TData>(
  snapshot: RevisionSnapshot<TData>,
  applySnapshot: (snapshot: RevisionSnapshot<TData>) => RevisionDataState<TDraft, TData>
): RevisionDataState<TDraft, TData> => {
  const nextState = applySnapshot(snapshot)
  nextState.isLoading = false
  return nextState
}

const applyLoadError = <TDraft, TData>(
  state: RevisionDataState<TDraft, TData>,
  message: string
): RevisionLoadResult<TDraft, TData> => {
  state.isLoading = false
  return { type: 'error', message }
}

const applyLoadStale = <TDraft, TData>(state: RevisionDataState<TDraft, TData>): void => {
  state.isLoading = false
}

const beginSave = <TDraft, TData>(state: RevisionDataState<TDraft, TData>): void => {
  state.isSaving = true
  state.saveError = null
  state.draftRevisionAtSave = state.draftRevision
}

const finishSave = <TDraft, TData>(
  state: RevisionDataState<TDraft, TData>,
  outcome: RevisionSaveOutcome,
  saveError: string | null = null
): RevisionSaveOutcome => {
  state.saveError = saveError
  state.draftRevisionAtSave = null
  state.isSaving = false
  return outcome
}

const applyServerSnapshot = <TDraft, TData>(
  state: RevisionDataState<TDraft, TData>,
  snapshot: RevisionSnapshot<TData>,
  createDraft: (snapshot: RevisionSnapshot<TData>) => TDraft,
  replaceDraft: boolean
): void => {
  state.baseSnapshot = snapshot
  if (replaceDraft) {
    state.draftSnapshot = createDraft(snapshot)
  }
}

const applySaveSuccess = <TDraft, TData>(
  state: RevisionDataState<TDraft, TData>,
  snapshot: RevisionSnapshot<TData>,
  createDraft: (snapshot: RevisionSnapshot<TData>) => TDraft,
  isDraftDirty: (draft: TDraft, base: RevisionSnapshot<TData>) => boolean
): RevisionSaveOutcome => {
  const shouldReplaceDraft = state.draftRevisionAtSave === state.draftRevision
  applyServerSnapshot(state, snapshot, createDraft, shouldReplaceDraft)
  const isDirty = isDraftDirty(state.draftSnapshot, state.baseSnapshot)
  return finishSave(state, isDirty ? 'unchanged' : 'saved')
}

const applySaveConflict = <TDraft, TData>(
  state: RevisionDataState<TDraft, TData>,
  snapshot: RevisionSnapshot<TData>,
  createDraft: (snapshot: RevisionSnapshot<TData>) => TDraft
): RevisionSaveOutcome => {
  applyServerSnapshot(state, snapshot, createDraft, true)
  return finishSave(state, 'conflict')
}

type RevisionLoadConfig<TDraft, TData, TLoadSuccess extends object> = {
  createSnapshotFromLoad: (result: TLoadSuccess) => RevisionSnapshot<TData>
  applyLoadedSnapshot: (snapshot: RevisionSnapshot<TData>) => RevisionDataState<TDraft, TData>
}

export function createRevisionDataStore<TDraft, TData>(params: {
  createDraft: (snapshot: RevisionSnapshot<TData>) => TDraft
  isDraftDirty: (draft: TDraft, base: RevisionSnapshot<TData>) => boolean
}): RevisionDataStoreBase<TDraft, TData>
export function createRevisionDataStore<
  TDraft,
  TData,
  TLoadSuccess extends object
>(params: {
  createDraft: (snapshot: RevisionSnapshot<TData>) => TDraft
  isDraftDirty: (draft: TDraft, base: RevisionSnapshot<TData>) => boolean
} & RevisionLoadConfig<TDraft, TData, TLoadSuccess>): RevisionDataStoreWithLoad<
  TDraft,
  TData,
  TLoadSuccess
>
export function createRevisionDataStore<
  TDraft,
  TData,
  TLoadSuccess extends object
>(
  params: {
    createDraft: (snapshot: RevisionSnapshot<TData>) => TDraft
    isDraftDirty: (draft: TDraft, base: RevisionSnapshot<TData>) => boolean
  } & Partial<RevisionLoadConfig<TDraft, TData, TLoadSuccess>>
): RevisionDataStoreBase<TDraft, TData> | RevisionDataStoreWithLoad<TDraft, TData, TLoadSuccess> {
  const { createDraft, isDraftDirty } = params

  const baseStore: RevisionDataStoreBase<TDraft, TData> = {
    createState: (base) => {
      return createRevisionDataState(base, createDraft(base))
    },
    markDraftChanged: (state) => {
      markDraftChanged(state)
    },
    beginSave: (state) => {
      beginSave(state)
    },
    applySaveSuccess: (state, snapshot) => {
      return applySaveSuccess(state, snapshot, createDraft, isDraftDirty)
    },
    applySaveConflict: (state, snapshot) => {
      return applySaveConflict(state, snapshot, createDraft)
    },
    applySaveError: (state, message) => {
      return finishSave(state, 'error', message)
    }
  }

  if (!params.createSnapshotFromLoad || !params.applyLoadedSnapshot) {
    return baseStore
  }

  const { createSnapshotFromLoad, applyLoadedSnapshot } = params

  return {
    ...baseStore,
    beginLoad: (state) => {
      return beginLoad(state)
    },
    createSnapshotFromLoad,
    applyLoadSuccess: (_state, snapshot) => {
      return applyLoadSuccess(snapshot, applyLoadedSnapshot)
    },
    applyLoadError: (state, message) => {
      return applyLoadError(state, message)
    },
    applyLoadStale: (state) => {
      applyLoadStale(state)
    }
  }
}
