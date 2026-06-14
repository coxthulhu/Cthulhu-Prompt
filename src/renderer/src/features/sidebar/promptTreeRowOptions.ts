import type { DraggableOptions, DroppableOptions } from '@renderer/features/drag-drop/dragDrop.svelte.ts'
import type {
  PromptHandleDragPayload,
  PromptHandleDropPayload
} from '@renderer/features/drag-drop/promptHandleDrag'

export type PromptRowDropOptions = DroppableOptions<PromptHandleDragPayload, PromptHandleDropPayload>
export type PromptRowDragOptions = DraggableOptions<PromptHandleDragPayload, PromptHandleDropPayload>
