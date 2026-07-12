export const PROMPT_HANDLE_DRAG_TYPE = 'prompt-handle'

export type PromptHandleDragPayload = {
  fromId: string
  sourceFolderId: string
}

export type PromptHandleDropPayload = {
  folderId: string
  targetEntryId: string | null
  position: 'before' | 'after'
}

export type PromptHandleMove = {
  sourcePromptFolderId: string
  destinationPromptFolderId: string
  promptId: string
  previousEntryId: string | null
}

const areEntryIdOrdersEqual = (left: string[], right: string[]): boolean => {
  return left.length === right.length && left.every((entryId, index) => entryId === right[index])
}

const reorderEntryIds = (
  currentEntryIds: string[],
  promptId: string,
  previousEntryId: string | null
): string[] | null => {
  const currentIndex = currentEntryIds.indexOf(promptId)
  if (currentIndex === -1) {
    return null
  }

  const nextEntryIds = [...currentEntryIds]
  nextEntryIds.splice(currentIndex, 1)

  if (previousEntryId == null) {
    nextEntryIds.unshift(promptId)
    return nextEntryIds
  }

  const previousIndex = nextEntryIds.indexOf(previousEntryId)
  if (previousIndex === -1) {
    return null
  }

  nextEntryIds.splice(previousIndex + 1, 0, promptId)
  return nextEntryIds
}

const resolvePreviousEntryIdForBeforeDrop = (
  destinationEntryIds: string[],
  draggedPromptId: string,
  targetEntryId: string
): string | null => {
  const targetIndex = destinationEntryIds.indexOf(targetEntryId)
  if (targetIndex === -1) {
    return null
  }

  // Skip the dragged prompt so same-folder "drop above" keeps the final ordering stable.
  for (let index = targetIndex - 1; index >= 0; index -= 1) {
    const previousEntryId = destinationEntryIds[index]
    if (previousEntryId !== draggedPromptId) {
      return previousEntryId
    }
  }

  return null
}

export const resolvePromptHandleDropMove = (
  sourcePromptFolderId: string,
  sourceEntryIds: string[],
  promptId: string,
  dropPayload: PromptHandleDropPayload | null,
  destinationEntryIds: string[] | null
): PromptHandleMove | null => {
  if (!dropPayload) {
    return null
  }

  if (dropPayload.targetEntryId === promptId) {
    return null
  }

  if (
    dropPayload.targetEntryId !== null &&
    dropPayload.position === 'before' &&
    !destinationEntryIds
  ) {
    return null
  }

  const previousEntryId =
    dropPayload.targetEntryId === null
      ? null
      : dropPayload.position === 'before'
        ? resolvePreviousEntryIdForBeforeDrop(
            destinationEntryIds!,
            promptId,
            dropPayload.targetEntryId
          )
        : dropPayload.targetEntryId

  if (sourcePromptFolderId === dropPayload.folderId) {
    const nextEntryIds = reorderEntryIds(sourceEntryIds, promptId, previousEntryId)
    if (!nextEntryIds || areEntryIdOrdersEqual(sourceEntryIds, nextEntryIds)) {
      return null
    }
  }

  return {
    sourcePromptFolderId,
    destinationPromptFolderId: dropPayload.folderId,
    promptId,
    previousEntryId
  }
}
