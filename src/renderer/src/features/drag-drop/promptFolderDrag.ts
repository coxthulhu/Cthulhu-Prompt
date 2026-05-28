export const PROMPT_FOLDER_ROW_DRAG_TYPE = 'prompt-folder-row'

export type PromptFolderRowDragPayload = {
  folderId: string
}

export type PromptFolderRowDropPayload = {
  folderId: string
  edge: 'top' | 'bottom'
}

export type PromptFolderRowMove = {
  folderId: string
  orderAfterFolderId: string | null
}

const areFolderIdOrdersEqual = (left: string[], right: string[]): boolean => {
  return left.length === right.length && left.every((folderId, index) => folderId === right[index])
}

const reorderFolderIds = (
  currentFolderIds: string[],
  folderId: string,
  orderAfterFolderId: string | null
): string[] | null => {
  const currentIndex = currentFolderIds.indexOf(folderId)
  if (currentIndex === -1) {
    return null
  }

  const nextFolderIds = [...currentFolderIds]
  nextFolderIds.splice(currentIndex, 1)

  if (orderAfterFolderId == null) {
    nextFolderIds.unshift(folderId)
    return nextFolderIds
  }

  const previousIndex = nextFolderIds.indexOf(orderAfterFolderId)
  if (previousIndex === -1) {
    return null
  }

  nextFolderIds.splice(previousIndex + 1, 0, folderId)
  return nextFolderIds
}

const resolveTopEdgeOrderAfterFolderId = (
  folderIds: string[],
  draggedFolderId: string,
  targetFolderId: string
): string | null => {
  const targetIndex = folderIds.indexOf(targetFolderId)
  if (targetIndex === -1) {
    return null
  }

  // Skip the dragged folder so same-list "drop above" keeps the final ordering stable.
  for (let index = targetIndex - 1; index >= 0; index -= 1) {
    const previousFolderId = folderIds[index]
    if (previousFolderId !== draggedFolderId) {
      return previousFolderId
    }
  }

  return null
}

export const resolvePromptFolderRowDropMove = (
  folderIds: string[],
  draggedFolderId: string,
  dropPayload: PromptFolderRowDropPayload | null
): PromptFolderRowMove | null => {
  if (!dropPayload || dropPayload.folderId === draggedFolderId) {
    return null
  }

  const orderAfterFolderId =
    dropPayload.edge === 'top'
      ? resolveTopEdgeOrderAfterFolderId(folderIds, draggedFolderId, dropPayload.folderId)
      : dropPayload.folderId
  const nextFolderIds = reorderFolderIds(folderIds, draggedFolderId, orderAfterFolderId)

  if (!nextFolderIds || areFolderIdOrdersEqual(folderIds, nextFolderIds)) {
    return null
  }

  return {
    folderId: draggedFolderId,
    orderAfterFolderId
  }
}
