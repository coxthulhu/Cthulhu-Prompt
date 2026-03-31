<script lang="ts">
  import {
    getPromptNavigationContext,
    type PromptNavigationRow
  } from '@renderer/app/PromptNavigationContext.svelte.ts'
  import { cn } from '@renderer/common/Cn.js'
  import { buttonVariants } from '@renderer/common/ui/button/button.svelte'
  import { GripVertical } from 'lucide-svelte'
  import { draggable } from '@renderer/features/drag-drop/dragDrop.svelte.ts'
  import {
    PROMPT_HANDLE_DRAG_TYPE,
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
  const toPromptNavigationRow = (nextPromptId: string): PromptNavigationRow => `prompt:${nextPromptId}`

  const handleDragStart = () => {
    promptNavigation.setViewedRowOverride({
      folderId: promptFolderId,
      row: toPromptNavigationRow(promptId)
    })
  }

  const handleDragFinish = (result: { sourcePayload: unknown; dropPayload: unknown | null }) => {
    promptNavigation.clearViewedRowOverride()

    // Keep these handlers referenced for future keyboard shortcuts.
    void onMoveUp
    void onMoveDown

    const dropPayload = result.dropPayload as PromptHandleDropPayload | null
    void result.sourcePayload
    void promptId
    void onPromptTreeDrop(dropPayload)
  }
</script>

<div class="w-6 flex-shrink-0 flex flex-col">
  {#snippet emptyDragPreview()}
    <span class="hidden" aria-hidden="true"></span>
  {/snippet}

  <button
    use:draggable={{
      dragType: PROMPT_HANDLE_DRAG_TYPE,
      payload: { fromId: promptId, sourceFolderId: promptFolderId },
      previewSnippet: emptyDragPreview,
      onDragStart: handleDragStart,
      onDragFinish: handleDragFinish
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
