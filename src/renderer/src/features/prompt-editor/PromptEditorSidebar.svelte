<script lang="ts">
  import { cn } from '@renderer/common/Cn.js'
  import { buttonVariants } from '@renderer/common/ui/button/button.svelte'
  import { GripVertical } from 'lucide-svelte'
  import {
    type DragDropPreview,
    draggable,
    type DragFinishResult,
    type DraggableOptions
  } from '@renderer/features/drag-drop/dragDrop.svelte.ts'
  import { getPromptNavigationContext } from '@renderer/app/PromptNavigationContext.svelte.ts'
  import {
    clearDraggedPromptHighlight,
    highlightDraggedPrompt
  } from '@renderer/features/drag-drop/promptDragHighlight'
  import {
    PROMPT_HANDLE_DRAG_TYPE,
    type PromptHandleDragPayload,
    type PromptHandleDropPayload
  } from '@renderer/features/drag-drop/promptHandleDrag'

  let {
    promptId,
    promptFolderId,
    onMoveUp,
    onMoveDown,
    onPromptTreeDrop
  }: {
    promptId: string
    promptFolderId: string
    onMoveUp: () => void | Promise<void>
    onMoveDown: () => void | Promise<void>
    onPromptTreeDrop: (dropPayload: PromptHandleDropPayload | null) => void | Promise<void>
  } = $props()

  const promptNavigation = getPromptNavigationContext()

  const handleDragStart = (sourcePayload: PromptHandleDragPayload): void => {
    highlightDraggedPrompt(promptNavigation, sourcePayload)
  }

  const handleDragFinish = ({
    dropPayload
  }: DragFinishResult<PromptHandleDragPayload, PromptHandleDropPayload>): void => {
    clearDraggedPromptHighlight(promptNavigation)

    // Keep these handlers referenced for future keyboard shortcuts.
    void onMoveUp
    void onMoveDown

    void onPromptTreeDrop(dropPayload)
  }

  const getDragHandleOptions = (
    previewSnippet: DragDropPreview
  ): DraggableOptions<PromptHandleDragPayload, PromptHandleDropPayload> => ({
    dragType: PROMPT_HANDLE_DRAG_TYPE,
    payload: {
      fromId: promptId,
      sourceFolderId: promptFolderId
    },
    previewSnippet,
    onDragStart: handleDragStart,
    onDragFinish: handleDragFinish
  })
</script>

<div class="w-6 flex-shrink-0 flex flex-col">
  {#snippet emptyDragPreview()}
    <span class="hidden" aria-hidden="true"></span>
  {/snippet}

  <button
    use:draggable={getDragHandleOptions(emptyDragPreview)}
    type="button"
    class={cn(
      buttonVariants({ variant: 'ghost', size: 'icon' }),
      'flex-1 w-5 rounded-none border-none !px-0 py-1 bg-muted/30 hover:bg-accent/30 shadow-none cursor-grab active:cursor-grabbing'
    )}
    aria-label="Drag prompt"
    data-testid="prompt-drag-handle"
  >
    <GripVertical class="size-4 stroke-[2.5]" />
  </button>
</div>
