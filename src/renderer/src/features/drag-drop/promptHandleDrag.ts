export const PROMPT_HANDLE_DRAG_TYPE = 'prompt-handle'

export type PromptHandleDragPayload = {
  fromId: string
  sourceFolderId: string
}

export type PromptFolderEntryDragPayload = {
  folderId: string
}

export type PromptTreeEntryDragPayload =
  | PromptHandleDragPayload
  | PromptFolderEntryDragPayload

export const isPromptHandleDragPayload = (
  payload: PromptTreeEntryDragPayload
): payload is PromptHandleDragPayload => 'sourceFolderId' in payload

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

export const resolveEntryDropPreviousEntryId = (
  draggedEntryId: string,
  dropPayload: PromptHandleDropPayload,
  destinationEntryIds: string[]
): string | null | undefined => {
  if (dropPayload.targetEntryId === draggedEntryId) return undefined
  if (dropPayload.targetEntryId === null) return null
  if (dropPayload.position === 'after') return dropPayload.targetEntryId

  const targetIndex = destinationEntryIds.indexOf(dropPayload.targetEntryId)
  if (targetIndex === -1) return undefined

  for (let index = targetIndex - 1; index >= 0; index -= 1) {
    const previousEntryId = destinationEntryIds[index]
    if (previousEntryId !== draggedEntryId) return previousEntryId
  }

  return null
}

export const doesEntryDropChangeOrder = (
  sourceFolderId: string,
  destinationFolderId: string,
  sourceEntryIds: string[],
  draggedEntryId: string,
  previousEntryId: string | null
): boolean => {
  if (sourceFolderId !== destinationFolderId) return true
  const nextEntryIds = reorderEntryIds(sourceEntryIds, draggedEntryId, previousEntryId)
  return Boolean(nextEntryIds && !areEntryIdOrdersEqual(sourceEntryIds, nextEntryIds))
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
    resolveEntryDropPreviousEntryId(promptId, dropPayload, destinationEntryIds ?? [])

  if (previousEntryId === undefined) return null

  if (
    !doesEntryDropChangeOrder(
      sourcePromptFolderId,
      dropPayload.folderId,
      sourceEntryIds,
      promptId,
      previousEntryId
    )
  ) {
    return null
  }

  return {
    sourcePromptFolderId,
    destinationPromptFolderId: dropPayload.folderId,
    promptId,
    previousEntryId
  }
}
