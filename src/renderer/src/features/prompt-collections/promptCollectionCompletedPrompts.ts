import type { PromptCollection } from '@shared/domain/prompt-collection/PromptCollection'
import { getPromptStatusFolderDefinition, type PromptContentStatus, type PromptStatusFolderId } from '@shared/domain/prompt/Prompt'

/** Finalized prompt paired with the collection-content owner used by navigation. */
export type FinalizedPromptWithOwner = {
  contentOwnerId: string
  promptId: string
}

/** Inputs used to collect one exact final status from its collection-owned layout. */
type CollectFinalizedPromptsOptions = {
  collection: PromptCollection
  statusFolderId: PromptStatusFolderId
  statusByPromptId: Readonly<Record<string, PromptContentStatus | undefined>>
  finalizedAtByPromptId: Readonly<Record<string, string | null | undefined>>
}

/** Collects and newest-first sorts prompts belonging to one final status. */
export const collectFinalizedPrompts = ({
  collection,
  statusFolderId,
  statusByPromptId,
  finalizedAtByPromptId
}: CollectFinalizedPromptsOptions): FinalizedPromptWithOwner[] => {
  /** Automatically ordered layout registered for the requested final status. */
  const layout = collection.statusFolders[statusFolderId]
  /** Matching prompt references projected with their navigation owner. */
  const finalizedPrompts = (layout.ordering === 'finalizedAt' ? layout.promptIds : []).flatMap(
    (promptId) =>
      statusByPromptId[promptId] !== undefined &&
      getPromptStatusFolderDefinition(statusByPromptId[promptId]!).id === statusFolderId
        ? [{ contentOwnerId: collection.id, promptId }]
        : []
  )

  return finalizedPrompts.sort((left, right) => {
    const leftFinalizedAt = finalizedAtByPromptId[left.promptId] ?? ''
    const rightFinalizedAt = finalizedAtByPromptId[right.promptId] ?? ''
    return rightFinalizedAt.localeCompare(leftFinalizedAt)
  })
}
