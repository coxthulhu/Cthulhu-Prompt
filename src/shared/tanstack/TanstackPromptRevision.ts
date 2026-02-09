import type { TanstackPrompt } from './TanstackPrompt'
import type { TanstackRevisionEnvelope, TanstackRevisionPayloadEntity } from './TanstackRevision'
import type {
  TanstackMutationRequest,
  TanstackMutationResultWithRequestId
} from './TanstackSystemSettingsRevision'

export type TanstackPromptRevisionPayload = {
  prompt: TanstackRevisionPayloadEntity<TanstackPrompt>
}

export type TanstackUpdatePromptRevisionRequest = TanstackMutationRequest<TanstackPromptRevisionPayload>

export type TanstackPromptRevisionData = TanstackRevisionEnvelope<TanstackPrompt>

export type TanstackPromptRevisionResponsePayload = {
  prompt: TanstackPromptRevisionData
}

export type TanstackUpdatePromptRevisionResult =
  TanstackMutationResultWithRequestId<TanstackPromptRevisionResponsePayload>
