import type { ParsedRequest } from './IpcValidation'
import type {
  IpcMutationResponseContext,
  IpcQueryResponseContext,
  IpcRequestWithPayload
} from '@shared/IpcRequest'
import type { IpcFailure } from '@shared/IpcResult'

const INVALID_REQUEST_PAYLOAD_ERROR = 'Invalid request payload'
const INVALID_CLIENT_ID_ERROR = 'Invalid client ID'

type RequestValidationError =
  | typeof INVALID_REQUEST_PAYLOAD_ERROR
  | typeof INVALID_CLIENT_ID_ERROR

type MutationInvalidRequestResult = IpcMutationResponseContext &
  IpcFailure & {
    error: RequestValidationError
  }

type QueryInvalidRequestResult = IpcQueryResponseContext &
  IpcFailure & {
    error: RequestValidationError
  }

type MutationResponseWithRequestContext<TResult extends object> = TResult extends object
  ? TResult & IpcMutationResponseContext
  : never

export const runMutationIpcRequest = async <
  TRequest extends IpcRequestWithPayload<unknown>,
  TResult extends object
>(
  request: unknown,
  parseRequest: (request: unknown) => ParsedRequest<TRequest>,
  run: (request: TRequest) => Promise<TResult>
): Promise<
  MutationResponseWithRequestContext<TResult> | MutationInvalidRequestResult
> => {
  const parsedRequest = parseRequest(request)

  if (!parsedRequest.success) {
    return {
      requestId: parsedRequest.requestId,
      clientId: parsedRequest.clientId,
      success: false,
      error: parsedRequest.clientId.length === 0
        ? INVALID_CLIENT_ID_ERROR
        : INVALID_REQUEST_PAYLOAD_ERROR
    }
  }

  // Side effect: attach request/client IDs from validated inputs to every mutation response.
  const result = await run(parsedRequest.value)
  return {
    ...result,
    requestId: parsedRequest.value.requestId,
    clientId: parsedRequest.value.clientId
  } as MutationResponseWithRequestContext<TResult>
}

export const runQueryIpcRequest = async <
  TRequest extends IpcRequestWithPayload<unknown>,
  TResult extends object
>(
  request: unknown,
  parseRequest: (request: unknown) => ParsedRequest<TRequest>,
  run: (request: TRequest) => Promise<TResult>
): Promise<TResult | QueryInvalidRequestResult> => {
  const parsedRequest = parseRequest(request)

  if (!parsedRequest.success) {
    return {
      clientId: parsedRequest.clientId,
      success: false,
      error: parsedRequest.clientId.length === 0
        ? INVALID_CLIENT_ID_ERROR
        : INVALID_REQUEST_PAYLOAD_ERROR
    }
  }

  const result = await run(parsedRequest.value)
  return {
    ...result,
    clientId: parsedRequest.value.clientId
  } as TResult
}
