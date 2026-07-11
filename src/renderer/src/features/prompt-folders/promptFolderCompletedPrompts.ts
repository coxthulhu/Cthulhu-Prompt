import type { PromptFolder } from '@shared/PromptFolder'

export type CompletedPromptWithOwner = {
  ownerFolderId: string
  promptId: string
}

type CollectCompletedPromptIdsOptions = {
  rootFolder: PromptFolder
  descendantFolders: readonly PromptFolder[]
  completedAtByPromptId: Readonly<Record<string, string | null | undefined>>
}

export const collectCompletedPrompts = ({
  rootFolder,
  descendantFolders,
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

    for (const promptId of folder.completedPromptIds) {
      completedPrompts.push({ ownerFolderId: folder.id, promptId })
    }

    for (const entryId of folder.entryIds) {
      const childFolder = folderById.get(entryId)
      if (childFolder) visitFolder(childFolder)
    }
  }

  visitFolder(rootFolder)

  return completedPrompts.sort((left, right) => {
    const leftCompletedAt = completedAtByPromptId[left.promptId] ?? ''
    const rightCompletedAt = completedAtByPromptId[right.promptId] ?? ''
    return rightCompletedAt.localeCompare(leftCompletedAt)
  })
}
