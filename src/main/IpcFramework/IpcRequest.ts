import type { ParsedRequest } from './IpcValidation'

const INVALID_REQUEST_PAYLOAD_ERROR = 'Invalid request payload'
const INVALID_CLIENT_ID_ERROR = 'Invalid client ID'

type RequestValidationError =
  | typeof INVALID_REQUEST_PAYLOAD_ERROR
  | typeof INVALID_CLIENT_ID_ERROR

type MutationInvalidRequestResult = {
  requestId: string
  clientId: string
  success: false
  error: RequestValidationError
}

type QueryInvalidRequestResult = {
  clientId: string
  success: false
  error: RequestValidationError
}

type MutationResponseWithRequestContext<TResult extends object> = TResult extends object
  ? TResult & { requestId: string; clientId: string }
  : never

export const runMutationIpcRequest = async <
  TRequest extends { requestId: string; clientId: string },
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
  TRequest extends { clientId: string },
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
