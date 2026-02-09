import type { TanstackPrompt } from './TanstackPrompt'
import type { TanstackPromptFolder } from './TanstackPromptFolder'
import type { TanstackRevisionEnvelope, TanstackRevisionPayloadEntity } from './TanstackRevision'
import type {
  TanstackMutationRequest,
  TanstackMutationResultWithRequestId,
  TanstackMutationWireRequest
} from './TanstackSystemSettingsRevision'

export type TanstackDeletePromptPayload = {
  promptFolder: TanstackRevisionPayloadEntity<TanstackPromptFolder>
  prompt: TanstackRevisionPayloadEntity<TanstackPrompt>
}

export type TanstackDeletePromptRequest = TanstackMutationRequest<TanstackDeletePromptPayload>

export type TanstackDeletePromptWireRequest = TanstackMutationWireRequest<TanstackDeletePromptRequest>

export type TanstackDeletePromptResponsePayload = {
  promptFolder: TanstackRevisionEnvelope<TanstackPromptFolder>
}

export type TanstackDeletePromptResult = TanstackMutationResultWithRequestId<
  TanstackDeletePromptResponsePayload
>
