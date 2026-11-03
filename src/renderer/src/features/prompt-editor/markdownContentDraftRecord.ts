import { NO_TEMPLATE_LABEL, TEMPLATE_NOT_SELECTED_LABEL } from '@renderer/common/emptyStateText'
import type { PromptFull, PromptTemplateReference } from '@shared/domain/prompt/Prompt'
import type { PromptTemplateFull } from '@shared/domain/prompt-template/PromptTemplate'

/** Editor view model for one full prompt or template, shared by the collection and single-prompt screens. */
export type MarkdownContentDraftRecord = {
  id: string
  /** Attached note identity projected alongside the owner's editor data. */
  attachedNoteId?: string
  title: string
  fallbackTitle: string
  modifiedAt: string
  text: string
  templates?: PromptTemplateReference[] | null
  templateName?: string
  templateState?: 'not-selected' | 'no-template' | 'selected'
  isEdited: boolean
}

/** Projects a full prompt with its resolved template label and session edit marker. */
export const buildPromptDraftRecord = (
  prompt: PromptFull,
  templateTitleById: Record<string, string>,
  isEdited: boolean
): MarkdownContentDraftRecord => {
  // Resolved names drive both the compact label and its additional-template count.
  const templateNames = (prompt.templates ?? []).flatMap((template) => {
    const title = templateTitleById[template.id]
    return title === undefined ? [] : [title]
  })
  // Missing references are skipped so the first available template names the selection.
  const templateName = templateNames[0]
  return {
    id: prompt.id,
    attachedNoteId: prompt.attachedNoteId,
    title: prompt.title,
    fallbackTitle: prompt.fallbackTitle,
    modifiedAt: prompt.modifiedAt,
    text: prompt.promptText,
    ...(prompt.templates !== undefined ? { templates: prompt.templates } : {}),
    templateName:
      prompt.templates === undefined
        ? TEMPLATE_NOT_SELECTED_LABEL
        : templateName === undefined
          ? NO_TEMPLATE_LABEL
          : templateNames.length > 1
            ? `${templateName} + ${templateNames.length - 1} More`
            : templateName,
    // Missing template ids use the same indicator treatment as No Template.
    templateState:
      prompt.templates === undefined
        ? 'not-selected'
        : templateName === undefined
          ? 'no-template'
          : 'selected',
    isEdited
  }
}

/** Projects a full template with its session edit marker. */
export const buildTemplateDraftRecord = (
  template: PromptTemplateFull,
  isEdited: boolean
): MarkdownContentDraftRecord => ({
  id: template.id,
  attachedNoteId: template.attachedNoteId,
  title: template.title,
  fallbackTitle: template.fallbackTitle,
  modifiedAt: template.modifiedAt,
  text: template.templateText,
  isEdited
})
