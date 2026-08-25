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

// Ordered reference to a prompt template selected for a prompt.
export type PromptTemplateReference = {
  id: string
}

export type PromptSummary = {
  id: string
  title: string
  fallbackTitle: string
  modifiedAt: string
  category?: string
  templates?: PromptTemplateReference[] | null
  status: PromptStatus
  completedAt?: string
  loadingState: 'summary'
}

export type PromptFull = {
  id: string
  title: string
  createdAt: string
  modifiedAt: string
  category?: string
  promptText: string
  fallbackTitle: string
  templates?: PromptTemplateReference[] | null
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
  | 'id'
  | 'title'
  | 'fallbackTitle'
  | 'modifiedAt'
  | 'category'
  | 'templates'
  | 'status'
  | 'completedAt'
>

export const createPromptSummary = (prompt: PromptSummaryData): PromptSummary => ({
  id: prompt.id,
  title: prompt.title,
  fallbackTitle: prompt.fallbackTitle,
  modifiedAt: prompt.modifiedAt,
  ...(prompt.category !== undefined ? { category: prompt.category } : {}),
  ...(prompt.templates !== undefined ? { templates: prompt.templates } : {}),
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
  ...(prompt.category !== undefined ? { category: prompt.category } : {}),
  promptText: prompt.promptText,
  fallbackTitle: prompt.fallbackTitle,
  ...(prompt.templates !== undefined ? { templates: prompt.templates } : {}),
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

export type DeletePromptResponsePayload = DeleteMarkdownContentResponsePayload<PromptPersisted>

export type MovePromptPayload = MoveMarkdownContentPayload<PromptPersisted>

export type MovePromptResponsePayload = MoveMarkdownContentResponsePayload<PromptPersisted>

/** Exact category-order placement used when a prompt enters the ordered tree. */
export type PromptCategoryOrderPlacement = {
  categoryId: string | null
  previousEntryId: string | null
}

export type SetPromptStatusPayload = {
  // Folder that currently owns the prompt shown in the active hierarchy.
  sourcePromptFolder: RevisionPayloadEntity<PromptFolder>
  // Root folder that owns completed prompts and restored active prompts.
  rootPromptFolder: RevisionPayloadEntity<PromptFolder>
  prompt: RevisionPayloadEntity<PromptPersisted>
  status: PromptStatus
  // Category-order placement retained for ordinary status changes or applied during restoration.
  categoryOrderPlacement: PromptCategoryOrderPlacement
}

export type SetPromptStatusResponsePayload = {
  // Authoritative source/root snapshots reconcile both sides of an ownership transfer.
  promptFolders: Array<RevisionEnvelope<PromptFolder>>
  prompt: RevisionEnvelope<PromptPersisted>
}
