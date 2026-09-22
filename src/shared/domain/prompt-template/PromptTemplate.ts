import { PromptStatus } from '@shared/domain/prompt/Prompt'

export type PromptTemplateSummary = {
  id: string
  title: string
  fallbackTitle: string
  modifiedAt: string
  category?: string
  /** Archive state shared with the task status infrastructure. */
  status?: PromptStatus.Todo | PromptStatus.Archived
  /** Time this template entered Archived. */
  finalizedAt?: string
  loadingState: 'summary'
}

export type PromptTemplateFull = {
  id: string
  title: string
  fallbackTitle: string
  createdAt: string
  modifiedAt: string
  category?: string
  templateText: string
  /** Archive state shared with the task status infrastructure. */
  status?: PromptStatus.Todo | PromptStatus.Archived
  /** Time this template entered Archived. */
  finalizedAt?: string
  loadingState: 'full'
}

export type PromptTemplate = PromptTemplateSummary | PromptTemplateFull

// Prompt template data as stored on disk.
export type PromptTemplatePersisted = Omit<PromptTemplateFull, 'loadingState'>

// Prompt template data loaded during workspace bootstrap for tree/title hydration.
export type PromptTemplateSummaryData = Pick<
  PromptTemplatePersisted,
  'id' | 'title' | 'fallbackTitle' | 'modifiedAt' | 'category' | 'status' | 'finalizedAt'
>

export const createPromptTemplateSummary = (
  template: PromptTemplateSummaryData
): PromptTemplateSummary => ({
  ...template,
  loadingState: 'summary'
})

export const createPromptTemplateFull = (
  template: PromptTemplatePersisted
): PromptTemplateFull => ({
  ...template,
  loadingState: 'full'
})

export const isPromptTemplateFull = (
  template: PromptTemplate
): template is PromptTemplateFull => template.loadingState === 'full'
