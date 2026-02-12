export type IpcRequestContext = {
  requestId: string
  clientId: string
}

export type IpcRequestWithPayload<TPayload> = IpcRequestContext & {
  payload: TPayload
}

export type IpcQueryResponseContext = {
  clientId: string
}

export type IpcMutationResponseContext = IpcQueryResponseContext & {
  requestId: string
}
