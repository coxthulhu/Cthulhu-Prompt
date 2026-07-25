import type { PromptHandleDragPayload } from './promptHandleDrag'

type DraggedPromptEntry =
  | {
      kind: 'content'
      folderId: string
      contentId: string
    }
  | {
      kind: 'folder'
      folderId: string
    }

let draggedEntry = $state<DraggedPromptEntry | null>(null)

export const startPromptDrag = (payload: PromptHandleDragPayload): void => {
  draggedEntry = {
    kind: 'content',
    folderId: payload.sourceFolderId,
    contentId: payload.fromId
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
