import type { LoadResult, RevisionDataResult } from '@shared/ipc'

export type RevisionSnapshot<T> = {
  data: T
  revision: number
}

export type RevisionSaveOutcome = 'idle' | 'saved' | 'conflict' | 'unchanged' | 'error'

export type RevisionSaveResult<TData> =
  | { type: 'saved'; snapshot: RevisionSnapshot<TData> }
  | { type: 'conflict'; snapshot: RevisionSnapshot<TData> }
  | { type: 'unchanged' }
  | { type: 'error'; message: string }

export type RevisionSaveResponse<TData> = RevisionDataResult<TData>

export type RevisionDataState<TDraft, TData> = {
  baseSnapshot: RevisionSnapshot<TData>
  draftSnapshot: TDraft
  savingSnapshot: RevisionSnapshot<TData> | null
  dirty: boolean
  isSaving: boolean
  isLoading: boolean
  loadRequestId: number
  loadError: string | null
  saveError: string | null
  saveOutcome: RevisionSaveOutcome
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
  saveRevisionData: (
    state: RevisionDataState<TDraft, TData>,
    savingSnapshot: RevisionSnapshot<TData>,
    save: () => Promise<RevisionSaveResult<TData>>
  ) => Promise<RevisionSaveOutcome>
}

export type RevisionDataStoreWithLoad<
  TDraft,
  TData,
  TLoadSuccess extends object
> = RevisionDataStoreBase<TDraft, TData> & {
  loadRevisionData: (
    state: RevisionDataState<TDraft, TData>,
    load: () => Promise<LoadResult<TLoadSuccess>>
  ) => Promise<RevisionLoadResult<TDraft, TData>>
}

export const toRevisionSaveResult = <TData>(
  result: RevisionSaveResponse<TData>,
  createSnapshot: (data: TData, revision: number) => RevisionSnapshot<TData>
): RevisionSaveResult<TData> => {
  if (result.success) {
    return {
      type: 'saved',
      snapshot: createSnapshot(result.data, result.revision)
    }
  }

  if (result.conflict) {
    return {
      type: 'conflict',
      snapshot: createSnapshot(result.data, result.revision)
    }
  }

  return { type: 'error', message: result.error }
}

const createRevisionDataState = <TDraft, TData>(
  base: RevisionSnapshot<TData>,
  draft: TDraft,
  isDraftDirty: (draft: TDraft, base: RevisionSnapshot<TData>) => boolean
): RevisionDataState<TDraft, TData> => ({
  baseSnapshot: base,
  draftSnapshot: draft,
  savingSnapshot: null,
  dirty: isDraftDirty(draft, base),
  isSaving: false,
  isLoading: false,
  loadRequestId: 0,
  loadError: null,
  saveError: null,
  saveOutcome: 'idle',
  draftRevision: 0,
  draftRevisionAtSave: null
})

const markDraftChanged = <TDraft, TData>(
  state: RevisionDataState<TDraft, TData>,
  isDraftDirty: (draft: TDraft, base: RevisionSnapshot<TData>) => boolean
): void => {
  // Track draft changes so we can avoid overwriting user edits during saves.
  state.draftRevision += 1
  state.dirty = isDraftDirty(state.draftSnapshot, state.baseSnapshot)
  state.saveOutcome = 'idle'
  state.saveError = null
}

const loadRevisionData = async <TDraft, TData, TLoadSuccess extends object>(
  state: RevisionDataState<TDraft, TData>,
  load: () => Promise<LoadResult<TLoadSuccess>>,
  createSnapshotFromLoad: (result: TLoadSuccess) => RevisionSnapshot<TData>,
  applySnapshot: (snapshot: RevisionSnapshot<TData>) => RevisionDataState<TDraft, TData>
): Promise<RevisionLoadResult<TDraft, TData>> => {
  const loadRequestId = state.loadRequestId + 1
  state.loadRequestId = loadRequestId
  state.isLoading = true
  state.loadError = null

  try {
    const response = await load()

    if (state.loadRequestId !== loadRequestId) {
      return { type: 'stale' }
    }

    if (!response.success) {
      state.isLoading = false
      state.loadError = response.error
      return { type: 'error', message: response.error }
    }

    const nextState = applySnapshot(createSnapshotFromLoad(response))
    nextState.isLoading = false
    nextState.loadError = null
    return { type: 'loaded', state: nextState }
  } catch (error) {
    if (state.loadRequestId !== loadRequestId) {
      return { type: 'stale' }
    }

    const message = error instanceof Error ? error.message : String(error)
    state.isLoading = false
    state.loadError = message
    return { type: 'error', message }
  }
}

const beginSave = <TDraft, TData>(
  state: RevisionDataState<TDraft, TData>,
  savingSnapshot: RevisionSnapshot<TData>
): void => {
  state.isSaving = true
  state.saveError = null
  state.saveOutcome = 'idle'
  state.savingSnapshot = savingSnapshot
  state.draftRevisionAtSave = state.draftRevision
}

const finishSave = <TDraft, TData>(
  state: RevisionDataState<TDraft, TData>,
  outcome: RevisionSaveOutcome,
  saveError: string | null = null
): RevisionSaveOutcome => {
  state.saveError = saveError
  state.saveOutcome = outcome
  state.savingSnapshot = null
  state.draftRevisionAtSave = null
  state.isSaving = false
  return outcome
}

const applyServerSnapshot = <TDraft, TData>(
  state: RevisionDataState<TDraft, TData>,
  snapshot: RevisionSnapshot<TData>,
  createDraft: (snapshot: RevisionSnapshot<TData>) => TDraft,
  isDraftDirty: (draft: TDraft, base: RevisionSnapshot<TData>) => boolean,
  replaceDraft: boolean
): void => {
  state.baseSnapshot = snapshot
  if (replaceDraft) {
    state.draftSnapshot = createDraft(snapshot)
  }
  state.dirty = isDraftDirty(state.draftSnapshot, state.baseSnapshot)
}

const applySaveSuccess = <TDraft, TData>(
  state: RevisionDataState<TDraft, TData>,
  snapshot: RevisionSnapshot<TData>,
  createDraft: (snapshot: RevisionSnapshot<TData>) => TDraft,
  isDraftDirty: (draft: TDraft, base: RevisionSnapshot<TData>) => boolean
): RevisionSaveOutcome => {
  const shouldReplaceDraft = state.draftRevisionAtSave === state.draftRevision
  applyServerSnapshot(state, snapshot, createDraft, isDraftDirty, shouldReplaceDraft)
  return finishSave(state, state.dirty ? 'unchanged' : 'saved')
}

const applySaveConflict = <TDraft, TData>(
  state: RevisionDataState<TDraft, TData>,
  snapshot: RevisionSnapshot<TData>,
  createDraft: (snapshot: RevisionSnapshot<TData>) => TDraft,
  isDraftDirty: (draft: TDraft, base: RevisionSnapshot<TData>) => boolean
): RevisionSaveOutcome => {
  applyServerSnapshot(state, snapshot, createDraft, isDraftDirty, true)
  return finishSave(state, 'conflict')
}

const saveRevisionData = async <TDraft, TData>(
  state: RevisionDataState<TDraft, TData>,
  savingSnapshot: RevisionSnapshot<TData>,
  createDraft: (snapshot: RevisionSnapshot<TData>) => TDraft,
  isDraftDirty: (draft: TDraft, base: RevisionSnapshot<TData>) => boolean,
  save: () => Promise<RevisionSaveResult<TData>>
): Promise<RevisionSaveOutcome> => {
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
      return createRevisionDataState(base, createDraft(base), isDraftDirty)
    },
    markDraftChanged: (state) => {
      markDraftChanged(state, isDraftDirty)
    },
    saveRevisionData: (state, savingSnapshot, save) => {
      return saveRevisionData(state, savingSnapshot, createDraft, isDraftDirty, save)
    }
  }

  if (!params.createSnapshotFromLoad || !params.applyLoadedSnapshot) {
    return baseStore
  }

  const { createSnapshotFromLoad, applyLoadedSnapshot } = params

  return {
    ...baseStore,
    loadRevisionData: (state, load) => {
      return loadRevisionData(state, load, createSnapshotFromLoad, applyLoadedSnapshot)
    }
  }
}
