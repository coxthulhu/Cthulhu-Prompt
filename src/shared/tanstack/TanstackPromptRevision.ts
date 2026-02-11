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

export type TanstackPromptRevisionResponsePayload = {
  prompt: TanstackRevisionEnvelope<TanstackPrompt>
}

export type TanstackUpdatePromptRevisionResult =
  TanstackMutationResultWithRequestId<TanstackPromptRevisionResponsePayload>
