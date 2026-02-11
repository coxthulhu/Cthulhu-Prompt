import type { Prompt } from './Prompt'
import type { RevisionEnvelope, RevisionPayloadEntity } from './Revision'
import type {
  MutationRequest,
  MutationResultWithRequestId
} from './SystemSettingsRevision'

export type PromptRevisionPayload = {
  prompt: RevisionPayloadEntity<Prompt>
}

export type UpdatePromptRevisionRequest = MutationRequest<PromptRevisionPayload>

export type PromptRevisionResponsePayload = {
  prompt: RevisionEnvelope<Prompt>
}

export type UpdatePromptRevisionResult =
  MutationResultWithRequestId<PromptRevisionResponsePayload>
