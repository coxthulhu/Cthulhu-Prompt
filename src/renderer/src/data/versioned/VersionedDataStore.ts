export type VersionedSnapshot<T> = {
  data: T
  version: number
}

export type VersionedDataState<TDraft, TData> = {
  base: VersionedSnapshot<TData>
  draft: TDraft
  pending: VersionedSnapshot<TData> | null
  isSaving: boolean
  errorMessage: string | null
}

export const createVersionedDataState = <TDraft, TData>(
  base: VersionedSnapshot<TData>,
  draft: TDraft
): VersionedDataState<TDraft, TData> => ({
  base,
  draft,
  pending: null,
  isSaving: false,
  errorMessage: null
})

export const applyServerSnapshotBase = <TDraft, TData>(
  state: VersionedDataState<TDraft, TData>,
  snapshot: VersionedSnapshot<TData>
): void => {
  state.base = snapshot
  state.pending = null
}

export const applyServerSnapshot = <TDraft, TData>(
  state: VersionedDataState<TDraft, TData>,
  snapshot: VersionedSnapshot<TData>,
  createDraft: (snapshot: VersionedSnapshot<TData>) => TDraft
): void => {
  applyServerSnapshotBase(state, snapshot)
  state.draft = createDraft(snapshot)
}
