import { createPrompt } from '@renderer/data/Mutations/PromptMutations'
import { compactGuid } from '@shared/compactGuid'
import { getCurrentIsoSecondTimestamp } from '@shared/isoTimestamp'
import { DEFAULT_PROMPT_FALLBACK_TITLE } from '@shared/promptFallbackTitle'
import { DEFAULT_PROMPT_STATUS_FOLDER_ID, PROMPT_STATUS_FOLDER_REGISTRY, type PromptStatusFolderId, type PromptFull } from '@shared/Prompt'

/** Created prompt identity and its pending persistence. */
export type BlankPromptCreation = {
  promptId: string
  persistence: Promise<void>
}

/** Creates a blank prompt at a category placement in the requested status group. */
export const createBlankPromptInFolder = (
  promptFolderId: string,
  previousEntryId: string | null,
  categoryId: string | null = null,
  statusFolderId: PromptStatusFolderId = DEFAULT_PROMPT_STATUS_FOLDER_ID
): BlankPromptCreation => {
  /** Stable identity shared by optimistic and persisted content. */
  const promptId = compactGuid(window.crypto.randomUUID())
  /** Timestamp for the initial prompt representation. */
  const now = getCurrentIsoSecondTimestamp()
  /** Blank editor representation using the group's entry status. */
  const optimisticPrompt: PromptFull = {
    id: promptId,
    title: '',
    fallbackTitle: DEFAULT_PROMPT_FALLBACK_TITLE,
    createdAt: now,
    modifiedAt: now,
    status: PROMPT_STATUS_FOLDER_REGISTRY[statusFolderId].entryStatus,
    promptText: '',
    loadingState: 'full'
  }

  return {
    promptId,
    persistence: createPrompt(promptFolderId, optimisticPrompt, previousEntryId, categoryId)
  }
}
