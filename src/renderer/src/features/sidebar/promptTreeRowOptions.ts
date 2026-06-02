import type { DraggableOptions, DroppableOptions } from '@renderer/features/drag-drop/dragDrop.svelte.ts'
import type {
  PromptHandleDragPayload,
  PromptHandleDropPayload
} from '@renderer/features/drag-drop/promptHandleDrag'
import type {
  PromptFolderRowDragPayload,
  PromptFolderRowDropPayload
} from '@renderer/features/drag-drop/promptFolderDrag'

export type PromptRowDropOptions = DroppableOptions<PromptHandleDragPayload, PromptHandleDropPayload>
export type PromptRowDragOptions = DraggableOptions<PromptHandleDragPayload, PromptHandleDropPayload>
export type FolderRowDropOptions = DroppableOptions<PromptFolderRowDragPayload, PromptFolderRowDropPayload>
export type FolderRowDragOptions = DraggableOptions<PromptFolderRowDragPayload, PromptFolderRowDropPayload>
