import type { MutationRequestWrapper, UpdatedMutationResult } from '@shared/ipc/updatedTypes'

import { registerMutationRequestId } from './registry'

export type UpdatedMutationResponder<TPayload> = {
  success: (payload: TPayload) => UpdatedMutationResult<TPayload>
  conflict: (payload: TPayload) => UpdatedMutationResult<TPayload>
  error: (message: string) => UpdatedMutationResult<TPayload>
}

export const updatedMutationError = <TPayload>(
  requestId: string,
  error: string
): UpdatedMutationResult<TPayload> => {
  return { requestId, success: false, error }
}

export const updatedMutationSuccess = <TPayload>(
  requestId: string,
  payload: TPayload
): UpdatedMutationResult<TPayload> => {
  return { requestId, success: true, payload }
}

export const updatedMutationConflict = <TPayload>(
  requestId: string,
  payload: TPayload
): UpdatedMutationResult<TPayload> => {
  return { requestId, success: false, conflict: true, payload }
}

export const runUpdatedMutation = async <
  TRequest extends MutationRequestWrapper<unknown>,
  TPayload
>(
  request: TRequest,
  run: (
    respond: UpdatedMutationResponder<TPayload>,
    request: TRequest
  ) => Promise<UpdatedMutationResult<TPayload>>
): Promise<UpdatedMutationResult<TPayload>> => {
  const { requestId } = request
  const respond: UpdatedMutationResponder<TPayload> = {
    success: (payload) => updatedMutationSuccess(requestId, payload),
    conflict: (payload) => updatedMutationConflict(requestId, payload),
    error: (message) => updatedMutationError(requestId, message)
  }

  if (!registerMutationRequestId(requestId)) {
    return respond.error('Duplicate mutation request')
  }

  return await run(respond, request)
}
