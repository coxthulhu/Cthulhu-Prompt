export type PromptTemplateSummary = {
  id: string
  title: string
  fallbackTitle: string
  modifiedAt: string
  loadingState: 'summary'
}

export type PromptTemplateFull = {
  id: string
  title: string
  fallbackTitle: string
  createdAt: string
  modifiedAt: string
  templateText: string
  loadingState: 'full'
}

export type PromptTemplate = PromptTemplateSummary | PromptTemplateFull

// Prompt template data as stored on disk.
export type PromptTemplatePersisted = Omit<PromptTemplateFull, 'loadingState'>

// Prompt template data loaded during workspace bootstrap for tree/title hydration.
export type PromptTemplateSummaryData = Pick<
  PromptTemplatePersisted,
  'id' | 'title' | 'fallbackTitle' | 'modifiedAt'
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

export type PromptTemplateRevisionPayload =
  MarkdownContentRevisionPayload<PromptTemplatePersisted>

export type PromptTemplateRevisionResponsePayload =
  MarkdownContentRevisionResponsePayload<PromptTemplatePersisted>

export type CreatePromptTemplatePayload = CreateMarkdownContentPayload<PromptTemplatePersisted>

export type CreatePromptTemplateResponsePayload =
  CreateMarkdownContentResponsePayload<PromptTemplatePersisted>

export type DeletePromptTemplatePayload = DeleteMarkdownContentPayload<PromptTemplatePersisted>

export type DeletePromptTemplateResponsePayload = DeleteMarkdownContentResponsePayload

export type MovePromptTemplatePayload = MoveMarkdownContentPayload<PromptTemplatePersisted>

export type MovePromptTemplateResponsePayload =
  MoveMarkdownContentResponsePayload<PromptTemplatePersisted>
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
