import type { VersionedDataResult } from '@shared/ipc'

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

export type VersionedLoadResponse =
  | { success: true }
  | { success: false; error: string }

export type VersionedLoadResult<TData> =
  | { type: 'loaded'; snapshot: VersionedSnapshot<TData> }
  | { type: 'error'; message: string }

export type VersionedSaveResponse<TData> = VersionedDataResult<TData>

export type VersionedDataState<TDraft, TData> = {
  baseSnapshot: VersionedSnapshot<TData>
  draftSnapshot: TDraft
  savingSnapshot: VersionedSnapshot<TData> | null
  dirty: boolean
  isSaving: boolean
  isLoading: boolean
  requestId: number
  loadErrorMessage: string | null
  saveErrorMessage: string | null
  saveOutcome: VersionedSaveOutcome
  draftRevision: number
  draftRevisionAtSave: number | null
}

export type VersionedDataStore<TDraft, TData> = {
  createState: (
    base: VersionedSnapshot<TData>
  ) => VersionedDataState<TDraft, TData>
  markDraftChanged: (state: VersionedDataState<TDraft, TData>) => void
  loadVersionedData: (
    state: VersionedDataState<TDraft, TData>,
    load: () => Promise<VersionedLoadResult<TData>>,
    applySnapshot: (
      snapshot: VersionedSnapshot<TData>
    ) => VersionedDataState<TDraft, TData>
  ) => Promise<
    | { type: 'loaded'; state: VersionedDataState<TDraft, TData> }
    | { type: 'error' }
    | { type: 'stale' }
  >
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

export const toVersionedLoadResult = <TResponse extends VersionedLoadResponse, TData>(
  result: TResponse,
  createSnapshot: (result: Extract<TResponse, { success: true }>) => VersionedSnapshot<TData>
): VersionedLoadResult<TData> => {
  if (!result.success) {
    return { type: 'error', message: result.error }
  }

  const successResult = result as Extract<TResponse, { success: true }>
  return { type: 'loaded', snapshot: createSnapshot(successResult) }
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
  requestId: 0,
  loadErrorMessage: null,
  saveErrorMessage: null,
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
  state.saveErrorMessage = null
}

const beginLoad = <TDraft, TData>(state: VersionedDataState<TDraft, TData>): number => {
  state.requestId += 1
  state.isLoading = true
  state.loadErrorMessage = null
  return state.requestId
}

const isLatestRequest = <TDraft, TData>(
  state: VersionedDataState<TDraft, TData>,
  requestId: number
): boolean => state.requestId === requestId

const finishLoadSuccess = <TDraft, TData>(state: VersionedDataState<TDraft, TData>): void => {
  state.isLoading = false
  state.loadErrorMessage = null
}

const finishLoadError = <TDraft, TData>(
  state: VersionedDataState<TDraft, TData>,
  message: string
): void => {
  state.isLoading = false
  state.loadErrorMessage = message
}

const loadVersionedData = async <TDraft, TData>(
  state: VersionedDataState<TDraft, TData>,
  load: () => Promise<VersionedLoadResult<TData>>,
  applySnapshot: (snapshot: VersionedSnapshot<TData>) => VersionedDataState<TDraft, TData>
): Promise<
  | { type: 'loaded'; state: VersionedDataState<TDraft, TData> }
  | { type: 'error' }
  | { type: 'stale' }
> => {
  const requestId = beginLoad(state)

  try {
    const result = await load()

    if (!isLatestRequest(state, requestId)) {
      return { type: 'stale' }
    }

    if (result.type === 'error') {
      finishLoadError(state, result.message)
      return { type: 'error' }
    }

    const nextState = applySnapshot(result.snapshot)
    finishLoadSuccess(nextState)
    return { type: 'loaded', state: nextState }
  } catch (error) {
    if (!isLatestRequest(state, requestId)) {
      return { type: 'stale' }
    }

    finishLoadError(state, error instanceof Error ? error.message : String(error))
    return { type: 'error' }
  }
}

const beginSave = <TDraft, TData>(
  state: VersionedDataState<TDraft, TData>,
  savingSnapshot: VersionedSnapshot<TData>
): void => {
  state.isSaving = true
  state.saveErrorMessage = null
  state.saveOutcome = 'idle'
  state.savingSnapshot = savingSnapshot
  state.draftRevisionAtSave = state.draftRevision
}

const finishSave = <TDraft, TData>(
  state: VersionedDataState<TDraft, TData>,
  outcome: VersionedSaveOutcome,
  saveErrorMessage: string | null = null
): VersionedSaveOutcome => {
  state.saveErrorMessage = saveErrorMessage
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
    loadVersionedData: (state, load, applySnapshot) => {
      return loadVersionedData(state, load, applySnapshot)
    },
    saveVersionedData: (state, savingSnapshot, save) => {
      return saveVersionedData(state, savingSnapshot, createDraft, isDraftDirty, save)
    }
  }
}
