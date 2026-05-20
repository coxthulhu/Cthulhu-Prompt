import type { PromptHandleDragPayload } from './promptHandleDrag'

type DraggedPromptRow = {
  folderId: string
  promptId: string
}

let draggedPromptRow = $state<DraggedPromptRow | null>(null)

export const setDraggedPromptRow = (payload: PromptHandleDragPayload): void => {
  draggedPromptRow = {
    folderId: payload.sourceFolderId,
    promptId: payload.fromId
  }
}

export const clearDraggedPromptRow = (): void => {
  draggedPromptRow = null
}

export const promptDragState = {
  get draggedPromptRow() {
    return draggedPromptRow
  }
}
