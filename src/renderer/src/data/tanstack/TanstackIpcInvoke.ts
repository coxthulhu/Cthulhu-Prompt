import { ipcInvoke } from '@renderer/api/ipcInvoke'

type TanstackIpcRequestWithPayload<TPayload> = {
  requestId: string
  payload: TPayload
}

type TanstackIpcRequestWithoutPayload = {
  requestId: string
}

const createTanstackRequestId = (): string => crypto.randomUUID()

export const tanstackIpcInvoke = <TResponse>(channel: string): Promise<TResponse> => {
  // Side effect: include a request ID for every TanStack IPC request.
  return ipcInvoke<TResponse, TanstackIpcRequestWithoutPayload>(channel, {
    requestId: createTanstackRequestId()
  })
}

export const tanstackIpcInvokeWithPayload = <TResponse, TPayload>(
  channel: string,
  payload: TPayload
): Promise<TResponse> => {
  // Side effect: include a request ID for every TanStack IPC request.
  return ipcInvoke<TResponse, TanstackIpcRequestWithPayload<TPayload>>(channel, {
    requestId: createTanstackRequestId(),
    payload
  })
}
