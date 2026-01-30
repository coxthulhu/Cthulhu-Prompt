import type { UpdatedMutationResult } from '@shared/ipc'

import { enqueueUpdatedGlobalMessage } from './UpdatedGlobalQueue'

export type UpdatedMutationOutcome<TData> =
  | { type: 'success'; result: Extract<UpdatedMutationResult<TData>, { success: true }> }
  | {
      type: 'conflict'
      result: Extract<UpdatedMutationResult<TData>, { success: false; conflict: true }>
    }
  | {
      type: 'error'
      error: unknown
      result?: Extract<UpdatedMutationResult<TData>, { success: false; conflict?: false }>
    }

export type UpdatedMutationParams<TSnapshot, TData> = {
  snapshot: () => TSnapshot
  run: (snapshot: TSnapshot) => Promise<UpdatedMutationResult<TData>>
  commitSuccess: (
    result: Extract<UpdatedMutationResult<TData>, { success: true }>,
    snapshot: TSnapshot
  ) => void
  rollbackConflict: (
    result: Extract<UpdatedMutationResult<TData>, { success: false; conflict: true }>
  ) => void
  rollbackError: (
    error: unknown,
    result?: Extract<UpdatedMutationResult<TData>, { success: false; conflict?: false }>
  ) => void
}

export type UpdatedSyncMutationParams<TSnapshot, TData> = UpdatedMutationParams<
  TSnapshot,
  TData
> & {
  optimisticMutation: () => void
}

/**
 * Updated mutation queue helpers (shared global queue with loads).
 *
 * Parameter usage and timing:
 * - optimisticMutation (sync-only): run immediately on enqueue to mutate draft state.
 *   Use this for complex, multi-entity updates that need optimistic UI changes.
 * - snapshot: run immediately after optimisticMutation (or immediately for autosaves).
 *   Capture a "saving snapshot" from the current draft; this snapshot is reused later.
 * - run: executed only when this task reaches the front of the global queue.
 *   Perform the IPC call using the snapshot captured at enqueue time.
 * - commitSuccess: called only when run returns success; commit optimistic changes and
 *   promote the saving snapshot to base state.
 * - rollbackConflict: called when run returns a conflict; restore base
 *   state and revert optimistic draft changes using your store helpers.
 * - rollbackError: called when run returns an error result or throws; restore
 *   base state and revert optimistic draft changes using your store helpers.
 *
 * Autosaves should skip optimisticMutation because the draft already includes
 * the field-level changes before enqueue time.
 */
const enqueueUpdatedMutation = <TSnapshot, TData>(
  params: UpdatedMutationParams<TSnapshot, TData>,
  snapshot: TSnapshot
): Promise<UpdatedMutationOutcome<TData>> =>
  enqueueUpdatedGlobalMessage(async () => {
    try {
      const result = await params.run(snapshot)

      if (result.success) {
        params.commitSuccess(result, snapshot)
        return { type: 'success', result }
      }

      if (result.conflict) {
        const outcome: UpdatedMutationOutcome<TData> = { type: 'conflict', result }
        params.rollbackConflict(result)
        return outcome
      }

      const outcome: UpdatedMutationOutcome<TData> = {
        type: 'error',
        error: result.error,
        result
      }
      params.rollbackError(result.error, result)
      return outcome
    } catch (error) {
      const outcome: UpdatedMutationOutcome<TData> = { type: 'error', error }
      params.rollbackError(error)
      return outcome
    }
  })

export const enqueueMutationApplyOptimistic = <TSnapshot, TData>(
  params: UpdatedSyncMutationParams<TSnapshot, TData>
): Promise<UpdatedMutationOutcome<TData>> => {
  params.optimisticMutation()
  const snapshot = params.snapshot()
  return enqueueUpdatedMutation(params, snapshot)
}

export const enqueueMutationAssumeOptimisticAlreadyApplied = <TSnapshot, TData>(
  params: UpdatedMutationParams<TSnapshot, TData>
): Promise<UpdatedMutationOutcome<TData>> => {
  const snapshot = params.snapshot()
  return enqueueUpdatedMutation(params, snapshot)
}
