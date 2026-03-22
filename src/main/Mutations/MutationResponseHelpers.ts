import type { CommittedEntry } from '../Data/CommittedStore'

export type MutationErrorResponse = {
  success: false
  error: string
}

export type MutationConflictResponse<TPayload> = {
  success: false
  conflict: true
  payload: TPayload
}

export const buildConflictResponseFromLatest = <TData, TPersistenceFields, TPayload>(
  latestEntry: CommittedEntry<TData, TPersistenceFields> | null,
  notLoadedError: string,
  payloadFactory: (entry: CommittedEntry<TData, TPersistenceFields>) => TPayload
): MutationErrorResponse | MutationConflictResponse<TPayload> => {
  if (!latestEntry) {
    return { success: false, error: notLoadedError }
  }

  return {
    success: false,
    conflict: true,
    payload: payloadFactory(latestEntry)
  }
}
