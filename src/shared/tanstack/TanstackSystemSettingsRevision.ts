import type { TanstackSystemSettings } from './TanstackSystemSettings'
import type { TanstackRevisionEnvelope, TanstackRevisionPayloadEntity } from './TanstackRevision'

export type TanstackMutationRequest<TPayload> = {
  requestId: string
  payload: TPayload
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
  | { requestId: string; success: true; payload: TanstackSystemSettingsRevisionResponsePayload }
  | {
      requestId: string
      success: false
      conflict: true
      payload: TanstackSystemSettingsRevisionResponsePayload
    }
  | { requestId: string; success: false; error: string; conflict?: false }
