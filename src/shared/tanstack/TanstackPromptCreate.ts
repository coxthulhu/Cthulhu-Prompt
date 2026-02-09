import type { TanstackPrompt } from './TanstackPrompt'
import type { TanstackPromptFolder } from './TanstackPromptFolder'
import type { TanstackRevisionEnvelope, TanstackRevisionPayloadEntity } from './TanstackRevision'
import type {
  TanstackMutationRequest,
  TanstackMutationResultWithRequestId,
  TanstackMutationWireRequest
} from './TanstackSystemSettingsRevision'

export type TanstackCreatePromptPayload = {
  promptFolder: TanstackRevisionPayloadEntity<TanstackPromptFolder>
  prompt: TanstackRevisionPayloadEntity<TanstackPrompt>
  previousPromptId: string | null
}

export type TanstackCreatePromptRequest = TanstackMutationRequest<TanstackCreatePromptPayload>

export type TanstackCreatePromptWireRequest = TanstackMutationWireRequest<TanstackCreatePromptRequest>

export type TanstackCreatePromptResponsePayload = {
  promptFolder: TanstackRevisionEnvelope<TanstackPromptFolder>
  prompt?: TanstackRevisionEnvelope<TanstackPrompt>
}

export type TanstackCreatePromptResult = TanstackMutationResultWithRequestId<
  TanstackCreatePromptResponsePayload
>
