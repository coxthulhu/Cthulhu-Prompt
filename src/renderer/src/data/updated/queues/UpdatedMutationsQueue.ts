import type { UpdatedMutationResult as MutationResult } from '@shared/ipc/updatedTypes'

import { enqueueGlobalMessage } from './UpdatedGlobalQueue'

export type MutationOutcome<TData> =
  | { type: 'success'; result: Extract<MutationResult<TData>, { success: true }> }
  | {
      type: 'conflict'
      result: Extract<MutationResult<TData>, { success: false; conflict: true }>
    }
  | {
      type: 'error'
      error: unknown
      result?: Extract<MutationResult<TData>, { success: false; conflict?: false }>
    }

export type MutationParams<TSnapshot, TData> = {
  snapshot: () => TSnapshot
  run: (snapshot: TSnapshot, requestId: string) => Promise<MutationResult<TData>>
  commitSuccess: (
    result: Extract<MutationResult<TData>, { success: true }>,
    snapshot: TSnapshot
  ) => void
  rollbackConflict: (
    result: Extract<MutationResult<TData>, { success: false; conflict: true }>
  ) => void
  rollbackError: (
    error: unknown,
    result?: Extract<MutationResult<TData>, { success: false; conflict?: false }>
  ) => void
}

export type SyncMutationParams<TSnapshot, TData> = MutationParams<TSnapshot, TData> & {
  optimisticMutation: () => void
}

/**
 * Mutation queue helpers (shared global queue with loads).
 *
 * Parameter usage and timing:
 * - optimisticMutation (sync-only): run immediately on enqueue to mutate draft state.
 *   Use this for complex, multi-entity updates that need optimistic UI changes.
 * - snapshot: run immediately after optimisticMutation (or immediately for autosaves).
 *   Capture a "saving snapshot" from the current draft; this snapshot is reused later.
 * - run: executed only when this task reaches the front of the global queue.
 *   Perform the IPC call using the snapshot captured at enqueue time.
 *   Use the requestId argument to populate mutation request wrappers.
 * - commitSuccess: called only when run returns success; commit optimistic changes and
 *   promote the saving snapshot to the most recent server authoritative snapshot.
 * - rollbackConflict: called when run returns a conflict; restore the most recent
 *   server authoritative snapshot and revert optimistic draft changes using your
 *   store helpers.
 * - rollbackError: called when run returns an error result or throws; restore the
 *   most recent server authoritative snapshot and revert optimistic draft changes
 *   using your store helpers.
 *
 * Autosaves should skip optimisticMutation because the draft already includes
 * the field-level changes before enqueue time.
 */
const enqueueMutation = <TSnapshot, TData>(
  params: MutationParams<TSnapshot, TData>,
  snapshot: TSnapshot
): Promise<MutationOutcome<TData>> => {
  // Create the request ID at enqueue time so retries reuse it.
  const requestId = crypto.randomUUID()
  return enqueueGlobalMessage(async () => {
    try {
      const result = await params.run(snapshot, requestId)

      if (result.success) {
        params.commitSuccess(result, snapshot)
        return { type: 'success', result }
      }

      if (result.conflict) {
        const outcome: MutationOutcome<TData> = { type: 'conflict', result }
        params.rollbackConflict(result)
        return outcome
      }

      const outcome: MutationOutcome<TData> = {
        type: 'error',
        error: result.error,
        result
      }
      params.rollbackError(result.error, result)
      return outcome
    } catch (error) {
      const outcome: MutationOutcome<TData> = { type: 'error', error }
      params.rollbackError(error)
      return outcome
    }
  })
}

export const enqueueMutationApplyOptimistic = <TSnapshot, TData>(
  params: SyncMutationParams<TSnapshot, TData>
): Promise<MutationOutcome<TData>> => {
  params.optimisticMutation()
  const snapshot = params.snapshot()
  return enqueueMutation(params, snapshot)
}

export const enqueueMutationAssumeOptimisticAlreadyApplied = <TSnapshot, TData>(
  params: MutationParams<TSnapshot, TData>
): Promise<MutationOutcome<TData>> => {
  const snapshot = params.snapshot()
  return enqueueMutation(params, snapshot)
}
