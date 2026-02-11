import type { Prompt } from './Prompt'
import type { PromptFolder } from './PromptFolder'
import type { RevisionEnvelope, RevisionPayloadEntity } from './Revision'
import type {
  MutationRequest,
  MutationResultWithRequestId,
  MutationWireRequest
} from './SystemSettingsRevision'

export type CreatePromptPayload = {
  promptFolder: RevisionPayloadEntity<PromptFolder>
  prompt: RevisionPayloadEntity<Prompt>
  previousPromptId: string | null
}

export type CreatePromptRequest = MutationRequest<CreatePromptPayload>

export type CreatePromptWireRequest = MutationWireRequest<CreatePromptRequest>

export type CreatePromptResponsePayload = {
  promptFolder: RevisionEnvelope<PromptFolder>
  prompt?: RevisionEnvelope<Prompt>
}

export type CreatePromptResult = MutationResultWithRequestId<
  CreatePromptResponsePayload
>
