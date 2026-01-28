import type { LoadResult } from '@shared/ipc'
import type {
  RevisionDataState,
  RevisionDataStoreWithLoad,
  RevisionLoadResult
} from './RevisionDataStore'

type GlobalLoadTask<T> = () => Promise<T>

let loadQueue: Promise<void> = Promise.resolve()

export const enqueueGlobalLoad = async <T>(task: GlobalLoadTask<T>): Promise<T> => {
  const run = loadQueue.then(task)
  loadQueue = run.then(
    () => undefined,
    () => undefined
  )
  return await run
}

export const createRevisionLoad = async <TDraft, TData, TLoadSuccess extends object>({
  store,
  state,
  run
}: {
  store: RevisionDataStoreWithLoad<TDraft, TData, TLoadSuccess>
  state: RevisionDataState<TDraft, TData>
  run: () => Promise<LoadResult<TLoadSuccess>>
}): Promise<RevisionLoadResult<TDraft, TData>> => {
  return await enqueueGlobalLoad(async () => {
    const requestId = store.beginLoad(state)

    try {
      const result = await run()

      if (state.loadRequestId !== requestId) {
        return { type: 'stale' }
      }

      if (!result.success) {
        return store.applyLoadError(state, result.error)
      }

      const snapshot = store.createSnapshotFromLoad(result as TLoadSuccess)

      if (snapshot.revision < state.baseSnapshot.revision) {
        store.applyLoadStale(state)
        return { type: 'stale' }
      }

      const nextState = store.applyLoadSuccess(state, snapshot)
      return { type: 'loaded', state: nextState }
    } catch (error) {
      if (state.loadRequestId !== requestId) {
        return { type: 'stale' }
      }

      const message = error instanceof Error ? error.message : String(error)
      return store.applyLoadError(state, message)
    }
  })
}
