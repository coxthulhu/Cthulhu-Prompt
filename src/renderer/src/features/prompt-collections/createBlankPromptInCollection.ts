import { createPrompt } from '@renderer/data/Mutations/PromptMutations'
import { compactGuid } from '@shared/utilities/compactGuid'
import { getCurrentIsoSecondTimestamp } from '@shared/utilities/isoTimestamp'
import { promptCollectionsCollection } from '@renderer/data/Collections/PromptCollectionsCollection'
import { collectionItemLabel } from '@shared/domain/prompt-collection/PromptCollection'
import { DEFAULT_PROMPT_STATUS_FOLDER_ID, getContentStatusFolderEntryStatus, type PromptStatusFolderId, type PromptFull } from '@shared/domain/prompt/Prompt'

/** Created prompt identity and its pending persistence. */
export type BlankPromptCreation = {
  promptId: string
  persistence: Promise<void>
}

/** Creates a blank prompt at a category placement in the requested status group. */
export const createBlankPromptInCollection = (
  promptCollectionId: string,
  previousEntryId: string | null,
  categoryId: string | null = null,
  statusFolderId: PromptStatusFolderId = DEFAULT_PROMPT_STATUS_FOLDER_ID
): BlankPromptCreation => {
  /** Stable identity shared by optimistic and persisted content. */
  const promptId = compactGuid(window.crypto.randomUUID())
  /** Timestamp for the initial prompt representation. */
  const now = getCurrentIsoSecondTimestamp()
  /** Owning collection determines the initial status, title, and template choice. */
  const kind = promptCollectionsCollection.get(promptCollectionId)!.kind
  /** Blank editor representation using the group's entry status. */
  const optimisticPrompt: PromptFull = {
    id: promptId,
    title: '',
    fallbackTitle: `New ${collectionItemLabel[kind]}`,
    ...(kind === 'routine' ? { templates: null } : {}),
    createdAt: now,
    modifiedAt: now,
    status: getContentStatusFolderEntryStatus(kind, statusFolderId),
    promptText: '',
    loadingState: 'full'
  }

  return {
    promptId,
    persistence: createPrompt(promptCollectionId, optimisticPrompt, previousEntryId, categoryId)
  }
}
