import type { TanstackSystemSettings } from './TanstackSystemSettings'
import type { TanstackRevisionEnvelope, TanstackRevisionPayloadEntity } from './TanstackRevision'

export type TanstackMutationRequest<TPayload> = {
  payload: TPayload
}

export type TanstackMutationWireRequest<
  TRequest extends TanstackMutationRequest<unknown>
> = TRequest & {
  requestId: string
}

export type TanstackMutationResult<TPayload> =
  | { success: true; payload: TPayload }
  | { success: false; conflict: true; payload: TPayload }
  | { success: false; error: string; conflict?: false }

export type TanstackMutationResultWithRequestId<TPayload> = TanstackMutationResult<TPayload> & {
  requestId: string
}

export type TanstackSystemSettingsRevisionPayload = {
  systemSettings: TanstackRevisionPayloadEntity<TanstackSystemSettings>
}

export type TanstackUpdateSystemSettingsRevisionRequest = TanstackMutationRequest<
  TanstackSystemSettingsRevisionPayload
>

export type TanstackSystemSettingsRevisionData = TanstackRevisionEnvelope<TanstackSystemSettings>

export type TanstackSystemSettingsRevisionResponsePayload = {
  systemSettings: TanstackSystemSettingsRevisionData
}

export type TanstackUpdateSystemSettingsRevisionResult =
  TanstackMutationResultWithRequestId<TanstackSystemSettingsRevisionResponsePayload>
