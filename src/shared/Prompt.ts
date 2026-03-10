import type { PromptFolder } from './PromptFolder'
import type { RevisionEnvelope, RevisionPayloadEntity } from './Revision'

export type PromptSummary = {
  id: string
  title: string
  loadingState: 'summary'
}

export type PromptFull = {
  id: string
  title: string
  creationDate: string
  lastModifiedDate: string
  promptText: string
  promptFolderCount: number
  loadingState: 'full'
}

export type Prompt = PromptSummary | PromptFull

// Prompt data as stored on disk and sent through prompt mutations.
export type PromptPersisted = Omit<PromptFull, 'loadingState'>

// Prompt data loaded during workspace bootstrap for tree/title hydration.
export type PromptSummaryData = Pick<PromptPersisted, 'id' | 'title'>

export const createPromptSummary = (prompt: PromptSummaryData): PromptSummary => ({
  id: prompt.id,
  title: prompt.title,
  loadingState: 'summary'
})

export const createPromptFull = (prompt: PromptPersisted): PromptFull => ({
  id: prompt.id,
  title: prompt.title,
  creationDate: prompt.creationDate,
  lastModifiedDate: prompt.lastModifiedDate,
  promptText: prompt.promptText,
  promptFolderCount: prompt.promptFolderCount,
  loadingState: 'full'
})

export const isPromptFull = (prompt: Prompt): prompt is PromptFull => {
  return prompt.loadingState === 'full'
}

export type PromptRevisionPayload = {
  prompt: RevisionPayloadEntity<PromptPersisted>
}

export type PromptRevisionResponsePayload = {
  prompt: RevisionEnvelope<PromptPersisted>
}

export type CreatePromptPayload = {
  promptFolder: RevisionPayloadEntity<PromptFolder>
  prompt: RevisionPayloadEntity<PromptPersisted>
  previousPromptId: string | null
}

export type CreatePromptResponsePayload = {
  promptFolder: RevisionEnvelope<PromptFolder>
  prompt?: RevisionEnvelope<PromptPersisted>
}

export type DeletePromptPayload = {
  promptFolder: RevisionPayloadEntity<PromptFolder>
  prompt: RevisionPayloadEntity<PromptPersisted>
}

export type DeletePromptResponsePayload = {
  promptFolder: RevisionEnvelope<PromptFolder>
}
