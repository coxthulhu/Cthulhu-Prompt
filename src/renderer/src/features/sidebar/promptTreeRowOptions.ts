import type {
  DraggableOptions,
  DroppableOptions
} from '@renderer/features/drag-drop/dragDrop.svelte.ts'
import type {
  CategoryDragPayload,
  CategoryDropPayload,
  PromptHandleDragPayload,
  PromptHandleDropPayload
} from '@renderer/features/drag-drop/promptHandleDrag'

export type PromptRowDropOptions = DroppableOptions<
  PromptHandleDragPayload,
  PromptHandleDropPayload
>
export type PromptRowDragOptions = DraggableOptions<
  PromptHandleDragPayload,
  PromptHandleDropPayload
>
/** Category-only drop options used by category boundaries in the prompt tree. */
export type CategoryRowDropOptions = DroppableOptions<CategoryDragPayload, CategoryDropPayload>
/** Category drag options shared by category handles in the prompt tree. */
export type CategoryRowDragOptions = DraggableOptions<CategoryDragPayload, CategoryDropPayload>
