import type { PromptContentFolder } from '@shared/PromptFolder'
import { PromptStatus, PromptStatusFolderId } from '@shared/Prompt'

/** Completed prompt paired with the root-content owner used by navigation. */
export type CompletedPromptWithOwner = {
  contentOwnerId: string
  promptId: string
}

type CollectCompletedPromptIdsOptions = {
  rootFolder: PromptContentFolder
  statusByPromptId: Readonly<Record<string, PromptStatus | undefined>>
  finalizedAtByPromptId: Readonly<Record<string, string | null | undefined>>
}

export const collectCompletedPrompts = ({
  rootFolder,
  statusByPromptId,
  finalizedAtByPromptId
}: CollectCompletedPromptIdsOptions): CompletedPromptWithOwner[] => {
  const completedPrompts = rootFolder.statusFolders[
    PromptStatusFolderId.Completed
  ].promptIds.flatMap((promptId) =>
    statusByPromptId[promptId] === PromptStatus.Completed
      ? [{ contentOwnerId: rootFolder.id, promptId }]
      : []
  )

  return completedPrompts.sort((left, right) => {
    const leftFinalizedAt = finalizedAtByPromptId[left.promptId] ?? ''
    const rightFinalizedAt = finalizedAtByPromptId[right.promptId] ?? ''
    return rightFinalizedAt.localeCompare(leftFinalizedAt)
  })
}
