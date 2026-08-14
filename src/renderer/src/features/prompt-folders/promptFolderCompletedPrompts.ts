import type { PromptFolder } from '@shared/PromptFolder'
import { PromptStatus } from '@shared/Prompt'

export type CompletedPromptWithOwner = {
  ownerFolderId: string
  promptId: string
}

type CollectCompletedPromptIdsOptions = {
  rootFolder: PromptFolder
  statusByPromptId: Readonly<Record<string, PromptStatus | undefined>>
  completedAtByPromptId: Readonly<Record<string, string | null | undefined>>
}

export const collectCompletedPrompts = ({
  rootFolder,
  statusByPromptId,
  completedAtByPromptId
}: CollectCompletedPromptIdsOptions): CompletedPromptWithOwner[] => {
  const completedPrompts = rootFolder.completedPromptIds.flatMap((promptId) =>
    statusByPromptId[promptId] === PromptStatus.Completed
      ? [{ ownerFolderId: rootFolder.id, promptId }]
      : []
  )

  return completedPrompts.sort((left, right) => {
    const leftCompletedAt = completedAtByPromptId[left.promptId] ?? ''
    const rightCompletedAt = completedAtByPromptId[right.promptId] ?? ''
    return rightCompletedAt.localeCompare(leftCompletedAt)
  })
}
