import type { ParsedRequest } from './IpcValidation'

const INVALID_REQUEST_PAYLOAD_ERROR = 'Invalid request payload'

type MutationInvalidRequestResult = {
  requestId: string
  success: false
  error: typeof INVALID_REQUEST_PAYLOAD_ERROR
}

type QueryInvalidRequestResult = {
  success: false
  error: typeof INVALID_REQUEST_PAYLOAD_ERROR
}

type MutationResponseWithRequestId<TResult extends object> = TResult extends object
  ? TResult & { requestId: string }
  : never

export const runMutationIpcRequest = async <
  TRequest extends { requestId: string },
  TResult extends object
>(
  request: unknown,
  parseRequest: (request: unknown) => ParsedRequest<TRequest>,
  run: (request: TRequest) => Promise<TResult>
): Promise<
  MutationResponseWithRequestId<TResult> | MutationInvalidRequestResult
> => {
  const parsedRequest = parseRequest(request)

  if (!parsedRequest.success) {
    return {
      requestId: parsedRequest.requestId,
      success: false,
      error: INVALID_REQUEST_PAYLOAD_ERROR
    }
  }

  // Side effect: attach request IDs from validated inputs to every mutation response.
  const result = await run(parsedRequest.value)
  return {
    ...result,
    requestId: parsedRequest.value.requestId
  } as MutationResponseWithRequestId<TResult>
}

export const runQueryIpcRequest = async <TRequest, TResult extends object>(
  request: unknown,
  parseRequest: (request: unknown) => ParsedRequest<TRequest>,
  run: (request: TRequest) => Promise<TResult>
): Promise<TResult | QueryInvalidRequestResult> => {
  const parsedRequest = parseRequest(request)

  if (!parsedRequest.success) {
    return {
      success: false,
      error: INVALID_REQUEST_PAYLOAD_ERROR
    }
  }

  return await run(parsedRequest.value)
}
