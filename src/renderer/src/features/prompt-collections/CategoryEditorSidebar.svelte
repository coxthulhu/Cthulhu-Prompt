<script lang="ts">
  import { GripVertical } from 'lucide-svelte'
  import type { Action } from 'svelte/action'
  import IconButton from '@renderer/common/cthulhu-ui/buttons/IconButton.svelte'
  import { draggable, type DraggableOptions } from '@renderer/common/drag-drop/dragDrop.svelte.ts'
  import type {
    CategoryDragPayload,
    CategoryDropPayload
  } from '@renderer/features/prompt-drag-drop/promptHandleDrag'

  /** Category drag-handle inputs supplied by the category row. */
  type Props = {
    dragOptions: DraggableOptions<CategoryDragPayload, CategoryDropPayload>
  }

  /** Draggable options for the category represented by this side rail. */
  let { dragOptions }: Props = $props()

  /** Prevents a category drag gesture from moving keyboard focus. */
  const preventSidebarButtonMouseFocus = (event: MouseEvent) => {
    if (event.button !== 0) return
    event.preventDefault()
  }

  /** Bridges the category drag options into the reusable draggable action. */
  const dragHandleAction: Action<HTMLButtonElement, unknown> = (node, options) => {
    const action = draggable(
      node,
      options as DraggableOptions<CategoryDragPayload, CategoryDropPayload>
    )
    return {
      update(nextOptions) {
        action.update(
          nextOptions as DraggableOptions<CategoryDragPayload, CategoryDropPayload>
        )
      },
      destroy: action.destroy
    }
  }
</script>

<div class="editor-card-rail category-editor-sidebar" data-testid="category-editor-sidebar">
  <IconButton
    icon={GripVertical}
    label="Drag category"
    size="sidebar-rail"
    baseVariant="dim"
    class="category-editor-sidebar-drag-button"
    testId="category-drag-handle"
    buttonAction={dragHandleAction}
    buttonActionParameter={dragOptions}
    grabCursor
    tabindex={-1}
    onmousedown={preventSidebarButtonMouseFocus}
  />
</div>

<style>
  .category-editor-sidebar :global(.cthulhuUiIconButton[data-size='sidebar-rail']) {
    border-bottom-color: transparent;
  }

  .category-editor-sidebar :global(.category-editor-sidebar-drag-button) {
    flex: 1 1 auto;
  }
</style>
