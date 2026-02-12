import type {
  IpcMutationResponseContext,
  IpcQueryResponseContext
} from './IpcRequest'

export type IpcSuccess<TData extends object = object> = { success: true } & TData

export type IpcFailure = {
  success: false
  error: string
}

export type IpcResult<TData extends object = object> =
  | IpcSuccess<TData>
  | IpcFailure

export type IpcMutationPayloadResult<TPayload> =
  | { success: true; payload: TPayload }
  | { success: false; conflict: true; payload: TPayload }
  | (IpcFailure & { conflict?: false })

export type IpcMutationActionResponse = IpcResult & IpcMutationResponseContext

export type IpcMutationPayloadResponse<TPayload> =
  IpcMutationPayloadResult<TPayload> & IpcMutationResponseContext

export type IpcQueryResponse<TData extends object = object> =
  IpcResult<TData> & IpcQueryResponseContext
