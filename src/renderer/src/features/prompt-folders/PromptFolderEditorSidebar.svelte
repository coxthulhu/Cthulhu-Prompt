<script lang="ts">
  import { GripVertical } from 'lucide-svelte'
  import type { Action } from 'svelte/action'
  import IconButton from '@renderer/common/cthulhu-ui/IconButton.svelte'
  import {
    draggable,
    type DraggableOptions
  } from '@renderer/features/drag-drop/dragDrop.svelte.ts'
  import type {
    PromptFolderEntryDragPayload,
    PromptHandleDropPayload
  } from '@renderer/features/drag-drop/promptHandleDrag'

  let { dragOptions }: {
    dragOptions: DraggableOptions<PromptFolderEntryDragPayload, PromptHandleDropPayload>
  } = $props()

  const preventSidebarButtonMouseFocus = (event: MouseEvent) => {
    if (event.button !== 0) return
    event.preventDefault()
  }

  const dragHandleAction: Action<HTMLButtonElement, unknown> = (node, options) => {
    const action = draggable(
      node,
      options as DraggableOptions<PromptFolderEntryDragPayload, PromptHandleDropPayload>
    )
    return {
      update(nextOptions) {
        action.update(
          nextOptions as DraggableOptions<PromptFolderEntryDragPayload, PromptHandleDropPayload>
        )
      },
      destroy: action.destroy
    }
  }
</script>

<div class="prompt-folder-editor-sidebar" data-testid="prompt-folder-editor-sidebar">
  <IconButton
    icon={GripVertical}
    label="Drag prompt folder"
    size="sidebar-rail"
    baseVariant="dim"
    class="prompt-folder-editor-sidebar-drag-button"
    testId="prompt-folder-drag-handle"
    buttonAction={dragHandleAction}
    buttonActionParameter={dragOptions}
    grabCursor
    tabindex={-1}
    onmousedown={preventSidebarButtonMouseFocus}
  />

</div>

<style>
  .prompt-folder-editor-sidebar {
    background: var(--ui-card-overlay-surface);
    display: flex;
    flex-direction: column;
    height: 100%;
    min-height: 0;
    min-width: 0;
    overflow: hidden;
    width: 36px;
  }

  .prompt-folder-editor-sidebar :global(.cthulhuUiIconButton[data-size='sidebar-rail']) {
    border-bottom-color: transparent;
  }

  .prompt-folder-editor-sidebar :global(.prompt-folder-editor-sidebar-drag-button) {
    flex: 1 1 auto;
  }
</style>
