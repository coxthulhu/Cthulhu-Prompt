import type { PromptFolder } from './PromptFolder'
import type { RevisionEnvelope, RevisionPayloadEntity } from './Revision'

export enum PromptStatus {
  ToDo = 'ToDo',
  Completed = 'Completed'
}

export type PromptSummary = {
  id: string
  title: string
  fallbackTitle: string
  status: PromptStatus
  completedAt?: string
  loadingState: 'summary'
}

export type PromptFull = {
  id: string
  title: string
  createdAt: string
  modifiedAt: string
  promptText: string
  fallbackTitle: string
  status: PromptStatus
  completedAt?: string
  loadingState: 'full'
}

export type Prompt = PromptSummary | PromptFull

// Prompt data as stored on disk and sent through prompt mutations.
export type PromptPersisted = Omit<PromptFull, 'loadingState'>

// Prompt data loaded during workspace bootstrap for tree/title hydration.
export type PromptSummaryData = Pick<
  PromptPersisted,
  'id' | 'title' | 'fallbackTitle' | 'status' | 'completedAt'
>

export const createPromptSummary = (prompt: PromptSummaryData): PromptSummary => ({
  id: prompt.id,
  title: prompt.title,
  fallbackTitle: prompt.fallbackTitle,
  status: prompt.status,
  ...(prompt.status === PromptStatus.Completed && prompt.completedAt
    ? { completedAt: prompt.completedAt }
    : {}),
  loadingState: 'summary'
})

export const createPromptFull = (prompt: PromptPersisted): PromptFull => ({
  id: prompt.id,
  title: prompt.title,
  createdAt: prompt.createdAt,
  modifiedAt: prompt.modifiedAt,
  promptText: prompt.promptText,
  fallbackTitle: prompt.fallbackTitle,
  status: prompt.status,
  ...(prompt.status === PromptStatus.Completed && prompt.completedAt
    ? { completedAt: prompt.completedAt }
    : {}),
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
  promptFolder?: RevisionEnvelope<PromptFolder>
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

export type MovePromptPayload = {
  sourcePromptFolder: RevisionPayloadEntity<PromptFolder>
  destinationPromptFolder: RevisionPayloadEntity<PromptFolder>
  prompt: RevisionPayloadEntity<PromptPersisted>
  orderAfterPromptId: string | null
}

export type MovePromptResponsePayload = {
  sourcePromptFolder: RevisionEnvelope<PromptFolder>
  destinationPromptFolder: RevisionEnvelope<PromptFolder>
  prompt: RevisionEnvelope<PromptPersisted>
}

export type CompletePromptPayload = {
  promptFolder: RevisionPayloadEntity<PromptFolder>
  prompt: RevisionPayloadEntity<PromptPersisted>
}

export type CompletePromptResponsePayload = {
  promptFolder: RevisionEnvelope<PromptFolder>
  prompt: RevisionEnvelope<PromptPersisted>
}

export type UncompletePromptPayload = {
  promptFolder: RevisionPayloadEntity<PromptFolder>
  prompt: RevisionPayloadEntity<PromptPersisted>
}

export type UncompletePromptResponsePayload = {
  promptFolder: RevisionEnvelope<PromptFolder>
  prompt: RevisionEnvelope<PromptPersisted>
}
