import type { PromptFolder } from './PromptFolder'
import type { RevisionEnvelope, RevisionPayloadEntity } from './Revision'
import type {
  CreateMarkdownContentPayload,
  CreateMarkdownContentResponsePayload,
  DeleteMarkdownContentPayload,
  DeleteMarkdownContentResponsePayload,
  MarkdownContentRevisionPayload,
  MarkdownContentRevisionResponsePayload,
  MoveMarkdownContentPayload,
  MoveMarkdownContentResponsePayload
} from './MarkdownContent'

export enum PromptStatus {
  Todo = 'Todo',
  InProgress = 'InProgress',
  Completed = 'Completed'
}

export type PromptSummary = {
  id: string
  title: string
  fallbackTitle: string
  modifiedAt: string
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
  'id' | 'title' | 'fallbackTitle' | 'modifiedAt' | 'status' | 'completedAt'
>

export const createPromptSummary = (prompt: PromptSummaryData): PromptSummary => ({
  id: prompt.id,
  title: prompt.title,
  fallbackTitle: prompt.fallbackTitle,
  modifiedAt: prompt.modifiedAt,
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

export type PromptRevisionPayload = MarkdownContentRevisionPayload<PromptPersisted>

export type PromptRevisionResponsePayload =
  MarkdownContentRevisionResponsePayload<PromptPersisted>

export type CreatePromptPayload = CreateMarkdownContentPayload<PromptPersisted>

export type CreatePromptResponsePayload = CreateMarkdownContentResponsePayload<PromptPersisted>

export type DeletePromptPayload = DeleteMarkdownContentPayload<PromptPersisted>

export type DeletePromptResponsePayload = DeleteMarkdownContentResponsePayload

export type MovePromptPayload = MoveMarkdownContentPayload<PromptPersisted>

export type MovePromptResponsePayload = MoveMarkdownContentResponsePayload<PromptPersisted>

export type SetPromptStatusPayload = {
  promptFolder: RevisionPayloadEntity<PromptFolder>
  prompt: RevisionPayloadEntity<PromptPersisted>
  status: PromptStatus
}

export type SetPromptStatusResponsePayload = {
  promptFolder: RevisionEnvelope<PromptFolder>
  prompt: RevisionEnvelope<PromptPersisted>
}
