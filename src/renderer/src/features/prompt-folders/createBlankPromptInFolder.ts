import { createPrompt } from '@renderer/data/Mutations/PromptMutations'
import { compactGuid } from '@shared/compactGuid'
import { getCurrentIsoSecondTimestamp } from '@shared/isoTimestamp'
import { DEFAULT_PROMPT_FALLBACK_TITLE } from '@shared/promptFallbackTitle'
import { PromptStatus, type PromptFull } from '@shared/Prompt'

export type BlankPromptCreation = {
  promptId: string
  persistence: Promise<void>
}

export const createBlankPromptInFolder = (
  promptFolderId: string,
  previousPromptId: string | null
): BlankPromptCreation => {
  const promptId = compactGuid(window.crypto.randomUUID())
  const now = getCurrentIsoSecondTimestamp()
  const optimisticPrompt: PromptFull = {
    id: promptId,
    title: '',
    fallbackTitle: DEFAULT_PROMPT_FALLBACK_TITLE,
    createdAt: now,
    modifiedAt: now,
    status: PromptStatus.ToDo,
    promptText: '',
    loadingState: 'full'
  }

  return {
    promptId,
    persistence: createPrompt(promptFolderId, optimisticPrompt, previousPromptId)
  }
}
