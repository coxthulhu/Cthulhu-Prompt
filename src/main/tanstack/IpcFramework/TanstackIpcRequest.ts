import type {
  TanstackMutationRequest,
  TanstackMutationWireRequest
} from '@shared/tanstack/TanstackSystemSettingsRevision'

export const runTanstackIpcRequest = async <
  TRequest extends TanstackMutationRequest<unknown>,
  TResult extends object
>(
  request: TanstackMutationWireRequest<TRequest>,
  run: (payload: TRequest['payload']) => Promise<TResult>
): Promise<TResult & { requestId: string }> => {
  // TODO: centralize requestId handling for TanStack IPC (tracing/idempotency).
  const result = await run(request.payload)
  return { requestId: request.requestId, ...result }
}
