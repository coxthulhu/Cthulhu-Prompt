import { createPromptTemplate } from '@renderer/data/Mutations/PromptTemplateMutations'
import { compactGuid } from '@shared/utilities/compactGuid'
import { getCurrentIsoSecondTimestamp } from '@shared/utilities/isoTimestamp'
import { DEFAULT_PROMPT_TEMPLATE_FALLBACK_TITLE } from '@shared/domain/prompt/promptFallbackTitle'
import type { PromptTemplateFull } from '@shared/domain/prompt-template/PromptTemplate'

export const createBlankPromptTemplateInFolder = (
  promptFolderId: string,
  previousEntryId: string | null,
  categoryId: string | null = null
): { templateId: string; persistence: Promise<void> } => {
  const templateId = compactGuid(window.crypto.randomUUID())
  const now = getCurrentIsoSecondTimestamp()
  const template: PromptTemplateFull = {
    id: templateId,
    title: '',
    fallbackTitle: DEFAULT_PROMPT_TEMPLATE_FALLBACK_TITLE,
    createdAt: now,
    modifiedAt: now,
    templateText: '',
    loadingState: 'full'
  }

  return {
    templateId,
    persistence: createPromptTemplate(
      promptFolderId,
      template,
      previousEntryId,
      categoryId
    )
  }
}
