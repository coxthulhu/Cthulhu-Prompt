import type { PromptFolder } from '@shared/PromptFolder'
import { PromptStatus } from '@shared/Prompt'

export type CompletedPromptWithOwner = {
  ownerFolderId: string
  promptId: string
}

type CollectCompletedPromptIdsOptions = {
  rootFolder: PromptFolder
  descendantFolders: readonly PromptFolder[]
  statusByPromptId: Readonly<Record<string, PromptStatus | undefined>>
  completedAtByPromptId: Readonly<Record<string, string | null | undefined>>
}

export const collectCompletedPrompts = ({
  rootFolder,
  descendantFolders,
  statusByPromptId,
  completedAtByPromptId
}: CollectCompletedPromptIdsOptions): CompletedPromptWithOwner[] => {
  const folderById = new Map(
    [...descendantFolders, rootFolder].map((folder) => [folder.id, folder])
  )
  const visitedFolderIds = new Set<string>()
  const completedPrompts: CompletedPromptWithOwner[] = []

  const visitFolder = (folder: PromptFolder): void => {
    if (visitedFolderIds.has(folder.id)) return
    visitedFolderIds.add(folder.id)

    for (const entry of folder.entries) {
      if (entry.kind === 'prompt' && statusByPromptId[entry.id] === PromptStatus.Completed) {
        completedPrompts.push({ ownerFolderId: folder.id, promptId: entry.id })
      } else if (entry.kind === 'folder') {
        const childFolder = folderById.get(entry.id)
        if (childFolder) visitFolder(childFolder)
      }
    }
  }

  visitFolder(rootFolder)

  return completedPrompts.sort((left, right) => {
    const leftCompletedAt = completedAtByPromptId[left.promptId] ?? ''
    const rightCompletedAt = completedAtByPromptId[right.promptId] ?? ''
    return rightCompletedAt.localeCompare(leftCompletedAt)
  })
}
