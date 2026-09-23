/** Templates have availability states, independent of task workflow. */
export enum PromptTemplateStatus {
  Active = 'Active',
  Archived = 'Archived'
}

export const isPromptTemplateStatus = (value: unknown): value is PromptTemplateStatus =>
  value === PromptTemplateStatus.Active || value === PromptTemplateStatus.Archived

export type PromptTemplateSummary = {
  id: string
  title: string
  fallbackTitle: string
  modifiedAt: string
  category?: string
  /** Availability within the template library. */
  status?: PromptTemplateStatus
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
  /** Availability within the template library. */
  status?: PromptTemplateStatus
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
  status: template.status ?? PromptTemplateStatus.Active,
  loadingState: 'summary'
})

export const createPromptTemplateFull = (
  template: PromptTemplatePersisted
): PromptTemplateFull => ({
  ...template,
  status: template.status ?? PromptTemplateStatus.Active,
  loadingState: 'full'
})

export const isPromptTemplateFull = (
  template: PromptTemplate
): template is PromptTemplateFull => template.loadingState === 'full'
