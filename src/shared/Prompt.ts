import type { PromptFolder } from './PromptFolder'
import type { RevisionEnvelope, RevisionPayloadEntity } from './Revision'
import type { MutationResultWithRequestId } from './SystemSettings'

export interface Prompt {
  id: string
  title: string
  creationDate: string
  lastModifiedDate: string
  promptText: string
  promptFolderCount: number
}

export type PromptRevisionPayload = {
  prompt: RevisionPayloadEntity<Prompt>
}

export type PromptRevisionResponsePayload = {
  prompt: RevisionEnvelope<Prompt>
}

export type UpdatePromptRevisionResult =
  MutationResultWithRequestId<PromptRevisionResponsePayload>

export type CreatePromptPayload = {
  promptFolder: RevisionPayloadEntity<PromptFolder>
  prompt: RevisionPayloadEntity<Prompt>
  previousPromptId: string | null
}

export type CreatePromptResponsePayload = {
  promptFolder: RevisionEnvelope<PromptFolder>
  prompt?: RevisionEnvelope<Prompt>
}

export type CreatePromptResult = MutationResultWithRequestId<
  CreatePromptResponsePayload
>

export type DeletePromptPayload = {
  promptFolder: RevisionPayloadEntity<PromptFolder>
  prompt: RevisionPayloadEntity<Prompt>
}

export type DeletePromptResponsePayload = {
  promptFolder: RevisionEnvelope<PromptFolder>
}

export type DeletePromptResult = MutationResultWithRequestId<
  DeletePromptResponsePayload
>
