import type { SystemSettings } from './SystemSettings'
import type { RevisionEnvelope, RevisionPayloadEntity } from './Revision'

export type MutationRequest<TPayload> = {
  payload: TPayload
}

export type MutationWireRequest<
  TRequest extends MutationRequest<unknown>
> = TRequest & {
  requestId: string
}

export type MutationResult<TPayload> =
  | { success: true; payload: TPayload }
  | { success: false; conflict: true; payload: TPayload }
  | { success: false; error: string; conflict?: false }

export type MutationResultWithRequestId<TPayload> = MutationResult<TPayload> & {
  requestId: string
}

export type SystemSettingsRevisionPayload = {
  systemSettings: RevisionPayloadEntity<SystemSettings>
}

export type UpdateSystemSettingsRevisionRequest = MutationRequest<
  SystemSettingsRevisionPayload
>

export type SystemSettingsRevisionResponsePayload = {
  systemSettings: RevisionEnvelope<SystemSettings>
}

export type UpdateSystemSettingsRevisionResult =
  MutationResultWithRequestId<SystemSettingsRevisionResponsePayload>
