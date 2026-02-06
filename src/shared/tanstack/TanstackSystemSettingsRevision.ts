import type { TanstackSystemSettings } from './TanstackSystemSettings'
import type { TanstackRevisionEnvelope } from './TanstackRevision'

export type TanstackMutationRequest<TPayload> = {
  requestId: string
  payload: TPayload
}

export type TanstackSystemSettingsRevisionPayload = {
  settings: TanstackSystemSettings
  expectedRevision: number
}

export type TanstackUpdateSystemSettingsRevisionRequest = TanstackMutationRequest<
  TanstackSystemSettingsRevisionPayload
>

export type TanstackSystemSettingsRevisionData = TanstackRevisionEnvelope<
  string,
  TanstackSystemSettings
>

export type TanstackUpdateSystemSettingsRevisionResult =
  | { requestId: string; success: true; payload: TanstackSystemSettingsRevisionData }
  | { requestId: string; success: false; conflict: true; payload: TanstackSystemSettingsRevisionData }
  | { requestId: string; success: false; error: string; conflict?: false }
