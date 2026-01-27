import type { LoadResult, VersionedDataResult } from '@shared/ipc'

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

export type VersionedSaveResponse<TData> = VersionedDataResult<TData>

export type VersionedDataState<TDraft, TData> = {
  baseSnapshot: VersionedSnapshot<TData>
  draftSnapshot: TDraft
  savingSnapshot: VersionedSnapshot<TData> | null
  dirty: boolean
  isSaving: boolean
  isLoading: boolean
  loadRequestId: number
  loadError: string | null
  saveError: string | null
  saveOutcome: VersionedSaveOutcome
  draftRevision: number
  draftRevisionAtSave: number | null
}

export type VersionedLoadResult<TDraft, TData> =
  | { type: 'loaded'; state: VersionedDataState<TDraft, TData> }
  | { type: 'error'; message: string }
  | { type: 'stale' }

export type VersionedDataStoreBase<TDraft, TData> = {
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

export type VersionedDataStoreWithLoad<
  TDraft,
  TData,
  TLoadSuccess extends object
> = VersionedDataStoreBase<TDraft, TData> & {
  loadVersionedData: (
    state: VersionedDataState<TDraft, TData>,
    load: () => Promise<LoadResult<TLoadSuccess>>
  ) => Promise<VersionedLoadResult<TDraft, TData>>
}

export const toVersionedSaveResult = <TData>(
  result: VersionedSaveResponse<TData>,
  createSnapshot: (data: TData, version: number) => VersionedSnapshot<TData>
): VersionedSaveResult<TData> => {
  if (result.success) {
    return {
      type: 'saved',
      snapshot: createSnapshot(result.data, result.version)
    }
  }

  if (result.conflict) {
    return {
      type: 'conflict',
      snapshot: createSnapshot(result.data, result.version)
    }
  }

  return { type: 'error', message: result.error }
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
  isLoading: false,
  loadRequestId: 0,
  loadError: null,
  saveError: null,
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
  state.saveError = null
}

const loadVersionedData = async <TDraft, TData, TLoadSuccess extends object>(
  state: VersionedDataState<TDraft, TData>,
  load: () => Promise<LoadResult<TLoadSuccess>>,
  createSnapshotFromLoad: (result: TLoadSuccess) => VersionedSnapshot<TData>,
  applySnapshot: (snapshot: VersionedSnapshot<TData>) => VersionedDataState<TDraft, TData>
): Promise<VersionedLoadResult<TDraft, TData>> => {
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
  state: VersionedDataState<TDraft, TData>,
  savingSnapshot: VersionedSnapshot<TData>
): void => {
  state.isSaving = true
  state.saveError = null
  state.saveOutcome = 'idle'
  state.savingSnapshot = savingSnapshot
  state.draftRevisionAtSave = state.draftRevision
}

const finishSave = <TDraft, TData>(
  state: VersionedDataState<TDraft, TData>,
  outcome: VersionedSaveOutcome,
  saveError: string | null = null
): VersionedSaveOutcome => {
  state.saveError = saveError
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

type VersionedLoadConfig<TDraft, TData, TLoadSuccess extends object> = {
  createSnapshotFromLoad: (result: TLoadSuccess) => VersionedSnapshot<TData>
  applyLoadedSnapshot: (snapshot: VersionedSnapshot<TData>) => VersionedDataState<TDraft, TData>
}

export function createVersionedDataStore<TDraft, TData>(params: {
  createDraft: (snapshot: VersionedSnapshot<TData>) => TDraft
  isDraftDirty: (draft: TDraft, base: VersionedSnapshot<TData>) => boolean
}): VersionedDataStoreBase<TDraft, TData>
export function createVersionedDataStore<
  TDraft,
  TData,
  TLoadSuccess extends object
>(params: {
  createDraft: (snapshot: VersionedSnapshot<TData>) => TDraft
  isDraftDirty: (draft: TDraft, base: VersionedSnapshot<TData>) => boolean
} & VersionedLoadConfig<TDraft, TData, TLoadSuccess>): VersionedDataStoreWithLoad<
  TDraft,
  TData,
  TLoadSuccess
>
export function createVersionedDataStore<
  TDraft,
  TData,
  TLoadSuccess extends object
>(
  params: {
    createDraft: (snapshot: VersionedSnapshot<TData>) => TDraft
    isDraftDirty: (draft: TDraft, base: VersionedSnapshot<TData>) => boolean
  } & Partial<VersionedLoadConfig<TDraft, TData, TLoadSuccess>>
): VersionedDataStoreBase<TDraft, TData> | VersionedDataStoreWithLoad<TDraft, TData, TLoadSuccess> {
  const { createDraft, isDraftDirty } = params

  const baseStore: VersionedDataStoreBase<TDraft, TData> = {
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

  if (!params.createSnapshotFromLoad || !params.applyLoadedSnapshot) {
    return baseStore
  }

  const { createSnapshotFromLoad, applyLoadedSnapshot } = params

  return {
    ...baseStore,
    loadVersionedData: (state, load) => {
      return loadVersionedData(state, load, createSnapshotFromLoad, applyLoadedSnapshot)
    }
  }
}
