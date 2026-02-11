import type { Prompt } from './Prompt'
import type { PromptFolder } from './PromptFolder'
import type { RevisionEnvelope, RevisionPayloadEntity } from './Revision'
import type {
  MutationRequest,
  MutationResultWithRequestId,
  MutationWireRequest
} from './SystemSettingsRevision'

export type DeletePromptPayload = {
  promptFolder: RevisionPayloadEntity<PromptFolder>
  prompt: RevisionPayloadEntity<Prompt>
}

export type DeletePromptRequest = MutationRequest<DeletePromptPayload>

export type DeletePromptWireRequest = MutationWireRequest<DeletePromptRequest>

export type DeletePromptResponsePayload = {
  promptFolder: RevisionEnvelope<PromptFolder>
}

export type DeletePromptResult = MutationResultWithRequestId<
  DeletePromptResponsePayload
>
