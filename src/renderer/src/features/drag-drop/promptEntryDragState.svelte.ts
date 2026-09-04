import type { PromptHandleDragPayload } from './promptHandleDrag'

/** Prompt-tree entry currently participating in a drag gesture. */
type DraggedPromptTreeEntry =
  | {
      kind: 'content'
      folderId: string
      contentId: string
      /** Workflow retained by folder-selector drops. */
      statusSection: PromptHandleDragPayload['statusSection']
    }
  | {
      kind: 'category'
      categoryId: string
    }

/** Shared transient drag state used by category and content rows. */
let draggedEntry = $state<DraggedPromptTreeEntry | null>(null)

export const startPromptDrag = (payload: PromptHandleDragPayload): void => {
  draggedEntry = {
    kind: 'content',
    folderId: payload.sourceFolderId,
    contentId: payload.fromId,
    statusSection: payload.statusSection
  }
}

/** Starts tracking a category reorder gesture. */
export const startCategoryDrag = (categoryId: string): void => {
  draggedEntry = { kind: 'category', categoryId }
}

export const clearPromptEntryDrag = (): void => {
  draggedEntry = null
}

export const promptEntryDragState = {
  get draggedEntry() {
    return draggedEntry
  }
}
