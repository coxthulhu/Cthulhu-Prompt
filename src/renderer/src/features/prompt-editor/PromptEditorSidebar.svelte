<script lang="ts">
  import { cn } from '@renderer/common/Cn.js'
  import { buttonVariants } from '@renderer/common/ui/button/button.svelte'
  import { GripVertical } from 'lucide-svelte'
  import { draggable } from '@renderer/features/drag-drop/dragDrop.svelte.ts'
  import {
    PROMPT_HANDLE_DRAG_TYPE,
    type PromptHandleDragPayload,
    type PromptHandleDropPayload
  } from '@renderer/features/drag-drop/promptHandleDrag'

  let {
    promptId,
    onMoveUp,
    onMoveDown
  }: {
    promptId: string
    onMoveUp: () => void | Promise<void>
    onMoveDown: () => void | Promise<void>
  } = $props()

  const handleDragEnd = (result: { sourcePayload: unknown; dropPayload: unknown | null }) => {
    // Keep these handlers referenced for future keyboard shortcuts.
    void onMoveUp
    void onMoveDown

    const sourcePayload = result.sourcePayload as PromptHandleDragPayload
    const dropPayload = result.dropPayload as PromptHandleDropPayload | null

    console.log('prompt-handle-drop', {
      fromId: sourcePayload.fromId,
      toId: dropPayload?.toId ?? null
    })
  }
</script>

<div class="w-6 flex-shrink-0 flex flex-col">
  <button
    use:draggable={{
      dragType: PROMPT_HANDLE_DRAG_TYPE,
      payload: { fromId: promptId },
      onDragEnd: handleDragEnd
    }}
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
