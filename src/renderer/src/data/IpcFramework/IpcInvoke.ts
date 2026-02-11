import { ipcInvoke as invokeIpc } from '@renderer/api/ipcInvoke'

type IpcRequestWithPayload<TPayload> = {
  requestId: string
  payload: TPayload
}

type IpcRequestWithoutPayload = {
  requestId: string
}

const createRequestId = (): string => crypto.randomUUID()

export const ipcInvoke = <TResponse>(channel: string): Promise<TResponse> => {
  // Side effect: include a request ID for every  IPC request.
  return invokeIpc<TResponse, IpcRequestWithoutPayload>(channel, {
    requestId: createRequestId()
  })
}

export const ipcInvokeWithPayload = <TResponse, TPayload>(
  channel: string,
  payload: TPayload
): Promise<TResponse> => {
  // Side effect: include a request ID for every  IPC request.
  return invokeIpc<TResponse, IpcRequestWithPayload<TPayload>>(channel, {
    requestId: createRequestId(),
    payload
  })
}
