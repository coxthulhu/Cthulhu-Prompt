import type { PromptHandleDragPayload } from './promptHandleDrag'

type DraggedPromptEntry =
  | {
      kind: 'prompt'
      folderId: string
      promptId: string
    }
  | {
      kind: 'folder'
      folderId: string
    }

let draggedEntry = $state<DraggedPromptEntry | null>(null)

export const startPromptDrag = (payload: PromptHandleDragPayload): void => {
  draggedEntry = {
    kind: 'prompt',
    folderId: payload.sourceFolderId,
    promptId: payload.fromId
  }
}

export const startPromptFolderDrag = (promptFolderId: string): void => {
  draggedEntry = { kind: 'folder', folderId: promptFolderId }
}

export const clearPromptEntryDrag = (): void => {
  draggedEntry = null
}

export const promptEntryDragState = {
  get draggedEntry() {
    return draggedEntry
  }
}
