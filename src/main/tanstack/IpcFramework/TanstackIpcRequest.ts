import type { TanstackParsedRequest } from './TanstackIpcValidation'

export const TANSTACK_INVALID_REQUEST_PAYLOAD_ERROR = 'Invalid request payload'

type TanstackMutationInvalidRequestResult = {
  requestId: string
  success: false
  error: typeof TANSTACK_INVALID_REQUEST_PAYLOAD_ERROR
}

type TanstackQueryInvalidRequestResult = {
  success: false
  error: typeof TANSTACK_INVALID_REQUEST_PAYLOAD_ERROR
}

type TanstackMutationResponseWithRequestId<TResult extends object> = TResult extends object
  ? TResult & { requestId: string }
  : never

export const runTanstackMutationIpcRequest = async <
  TRequest extends { requestId: string },
  TResult extends object
>(
  request: unknown,
  parseRequest: (request: unknown) => TanstackParsedRequest<TRequest>,
  run: (request: TRequest) => Promise<TResult>
): Promise<
  TanstackMutationResponseWithRequestId<TResult> | TanstackMutationInvalidRequestResult
> => {
  const parsedRequest = parseRequest(request)

  if (!parsedRequest.success) {
    return {
      requestId: parsedRequest.requestId,
      success: false,
      error: TANSTACK_INVALID_REQUEST_PAYLOAD_ERROR
    }
  }

  // Side effect: attach request IDs from validated inputs to every mutation response.
  const result = await run(parsedRequest.value)
  return {
    ...result,
    requestId: parsedRequest.value.requestId
  } as TanstackMutationResponseWithRequestId<TResult>
}

export const runTanstackQueryIpcRequest = async <TRequest, TResult extends object>(
  request: unknown,
  parseRequest: (request: unknown) => TanstackParsedRequest<TRequest>,
  run: (request: TRequest) => Promise<TResult>
): Promise<TResult | TanstackQueryInvalidRequestResult> => {
  const parsedRequest = parseRequest(request)

  if (!parsedRequest.success) {
    return {
      success: false,
      error: TANSTACK_INVALID_REQUEST_PAYLOAD_ERROR
    }
  }

  return await run(parsedRequest.value)
}
