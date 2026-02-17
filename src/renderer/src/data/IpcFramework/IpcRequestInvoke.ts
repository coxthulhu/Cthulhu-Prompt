import { ipcInvoke as invokeIpc } from './IpcInvoke'
import type {
  IpcRequestContext,
  IpcRequestWithPayload
} from '@shared/IpcRequest'

const createRequestId = (): string => crypto.randomUUID()
const getClientId = (): string => window.ipcClientId

export const ipcInvoke = <TResponse>(channel: string): Promise<TResponse> => {
  // Side effect: include request/client IDs for every typed IPC request.
  return invokeIpc<TResponse, IpcRequestContext>(channel, {
    requestId: createRequestId(),
    clientId: getClientId()
  })
}

export const ipcInvokeWithPayload = <TResponse, TPayload>(
  channel: string,
  payload: TPayload
): Promise<TResponse> => {
  // Side effect: include request/client IDs for every typed IPC request.
  return invokeIpc<TResponse, IpcRequestWithPayload<TPayload>>(channel, {
    requestId: createRequestId(),
    clientId: getClientId(),
    payload
  })
}
