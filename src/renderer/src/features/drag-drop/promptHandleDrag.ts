export const PROMPT_HANDLE_DRAG_TYPE = 'prompt-handle'

export type PromptHandleDragPayload = {
  fromId: string
  sourceFolderId: string
}

export type PromptHandleDropPayload =
  | {
      kind: 'folder'
      folderId: string
    }
  | {
      kind: 'folder-settings'
      folderId: string
    }
  | {
      kind: 'prompt'
      folderId: string
      promptId: string
      edge: 'top' | 'bottom'
    }

export type PromptHandleMove = {
  sourcePromptFolderId: string
  destinationPromptFolderId: string
  promptId: string
  orderAfterPromptId: string | null
}

const arePromptIdOrdersEqual = (left: string[], right: string[]): boolean => {
  return left.length === right.length && left.every((promptId, index) => promptId === right[index])
}

const reorderPromptIds = (
  currentPromptIds: string[],
  promptId: string,
  orderAfterPromptId: string | null
): string[] | null => {
  const currentIndex = currentPromptIds.indexOf(promptId)
  if (currentIndex === -1) {
    return null
  }

  const nextPromptIds = [...currentPromptIds]
  nextPromptIds.splice(currentIndex, 1)

  if (orderAfterPromptId == null) {
    nextPromptIds.unshift(promptId)
    return nextPromptIds
  }

  const previousIndex = nextPromptIds.indexOf(orderAfterPromptId)
  if (previousIndex === -1) {
    return null
  }

  nextPromptIds.splice(previousIndex + 1, 0, promptId)
  return nextPromptIds
}

const resolveTopEdgeOrderAfterPromptId = (
  destinationPromptIds: string[],
  draggedPromptId: string,
  targetPromptId: string
): string | null => {
  const targetIndex = destinationPromptIds.indexOf(targetPromptId)
  if (targetIndex === -1) {
    return null
  }

  // Skip the dragged prompt so same-folder "drop above" keeps the final ordering stable.
  for (let index = targetIndex - 1; index >= 0; index -= 1) {
    const previousPromptId = destinationPromptIds[index]
    if (previousPromptId !== draggedPromptId) {
      return previousPromptId
    }
  }

  return null
}

export const resolvePromptHandleDropMove = (
  sourcePromptFolderId: string,
  sourcePromptIds: string[],
  promptId: string,
  dropPayload: PromptHandleDropPayload | null,
  destinationPromptIds: string[] | null
): PromptHandleMove | null => {
  if (!dropPayload) {
    return null
  }

  if (dropPayload.kind === 'prompt' && dropPayload.promptId === promptId) {
    return null
  }

  const nextMove =
    dropPayload.kind === 'prompt'
      ? {
          destinationPromptFolderId: dropPayload.folderId,
          orderAfterPromptId:
            dropPayload.edge === 'top'
              ? destinationPromptIds
                ? resolveTopEdgeOrderAfterPromptId(
                    destinationPromptIds,
                    promptId,
                    dropPayload.promptId
                  )
                : null
              : dropPayload.promptId
        }
      : {
          destinationPromptFolderId: dropPayload.folderId,
          orderAfterPromptId: null
        }

  if (dropPayload.kind === 'prompt' && dropPayload.edge === 'top' && !destinationPromptIds) {
    return null
  }

  if (sourcePromptFolderId === nextMove.destinationPromptFolderId) {
    const nextPromptIds = reorderPromptIds(sourcePromptIds, promptId, nextMove.orderAfterPromptId)
    if (!nextPromptIds || arePromptIdOrdersEqual(sourcePromptIds, nextPromptIds)) {
      return null
    }
  }

  return {
    sourcePromptFolderId,
    destinationPromptFolderId: nextMove.destinationPromptFolderId,
    promptId,
    orderAfterPromptId: nextMove.orderAfterPromptId
  }
}
