import type { PromptFolder } from './PromptFolder'
import type { RevisionEnvelope, RevisionPayloadEntity } from './Revision'

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

export type CreatePromptPayload = {
  promptFolder: RevisionPayloadEntity<PromptFolder>
  prompt: RevisionPayloadEntity<Prompt>
  previousPromptId: string | null
}

export type CreatePromptResponsePayload = {
  promptFolder: RevisionEnvelope<PromptFolder>
  prompt?: RevisionEnvelope<Prompt>
}

export type DeletePromptPayload = {
  promptFolder: RevisionPayloadEntity<PromptFolder>
  prompt: RevisionPayloadEntity<Prompt>
}

export type DeletePromptResponsePayload = {
  promptFolder: RevisionEnvelope<PromptFolder>
}
