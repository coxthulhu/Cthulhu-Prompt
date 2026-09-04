import type { PromptContentFolder } from '@shared/PromptFolder'
import { getPromptStatusFolderDefinition, type PromptStatus, type PromptStatusFolderId } from '@shared/Prompt'

/** Finalized prompt paired with the root-content owner used by navigation. */
export type FinalizedPromptWithOwner = {
  contentOwnerId: string
  promptId: string
}

/** Inputs used to collect one exact final status from its root-owned layout. */
type CollectFinalizedPromptsOptions = {
  rootFolder: PromptContentFolder
  statusFolderId: PromptStatusFolderId
  statusByPromptId: Readonly<Record<string, PromptStatus | undefined>>
  finalizedAtByPromptId: Readonly<Record<string, string | null | undefined>>
}

/** Collects and newest-first sorts prompts belonging to one final status. */
export const collectFinalizedPrompts = ({
  rootFolder,
  statusFolderId,
  statusByPromptId,
  finalizedAtByPromptId
}: CollectFinalizedPromptsOptions): FinalizedPromptWithOwner[] => {
  /** Automatically ordered layout registered for the requested final status. */
  const layout = rootFolder.statusFolders[statusFolderId]
  /** Matching prompt references projected with their navigation owner. */
  const finalizedPrompts = (layout.ordering === 'finalizedAt' ? layout.promptIds : []).flatMap(
    (promptId) =>
      statusByPromptId[promptId] !== undefined &&
      getPromptStatusFolderDefinition(statusByPromptId[promptId]!).id === statusFolderId
        ? [{ contentOwnerId: rootFolder.id, promptId }]
        : []
  )

  return finalizedPrompts.sort((left, right) => {
    const leftFinalizedAt = finalizedAtByPromptId[left.promptId] ?? ''
    const rightFinalizedAt = finalizedAtByPromptId[right.promptId] ?? ''
    return rightFinalizedAt.localeCompare(leftFinalizedAt)
  })
}
