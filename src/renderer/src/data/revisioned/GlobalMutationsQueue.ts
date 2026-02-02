import type { RevisionDataState, RevisionDataStoreBase } from './RevisionDataStore'
import { createSerialQueue } from './SerialQueue'

export const enqueueGlobalMutation = createSerialQueue()

export type RevisionMutationElement<TDraft, TData> = {
  store: RevisionDataStoreBase<TDraft, TData>
  state: RevisionDataState<TDraft, TData>
}

type ConflictableResult = { success: true } | { success: false; conflict: true }

export const createRevisionMutation = <
  TResult extends ConflictableResult,
  TOutcome,
  TDraft,
  TData
>({
  elements,
  run,
  onSuccess,
  onConflict
}: {
  elements: ReadonlyArray<RevisionMutationElement<TDraft, TData>>
  run: (revisions: number[]) => Promise<TResult>
  onSuccess: (result: TResult) => TOutcome
  onConflict: (result: TResult) => TOutcome
}): Promise<TOutcome> => {
  const revisions = elements.map((element) => element.state.baseSnapshot.revision)

  return enqueueGlobalMutation(async () => {
    for (const element of elements) {
      element.store.beginSave(element.state)
    }

    try {
      const result = await run(revisions)
      if (result.success) {
        return onSuccess(result)
      }
      return onConflict(result)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      for (const element of elements) {
        element.store.applySaveError(element.state, message)
      }
      throw error
    }
  })
}
