<script lang="ts">
  import type { Action } from 'svelte/action'
  import IconButton from '@renderer/common/cthulhu-ui/IconButton.svelte'
  import { ChevronDown, ChevronUp, GripVertical } from 'lucide-svelte'
  import {
    draggable,
    type DragFinishResult,
    type DraggableOptions
  } from '@renderer/features/drag-drop/dragDrop.svelte.ts'
  import {
    clearDraggedPromptRow,
    setDraggedPromptRow
  } from '@renderer/features/drag-drop/promptDragState.svelte.ts'
  import {
    PROMPT_HANDLE_DRAG_TYPE,
    type PromptHandleDragPayload,
    type PromptHandleDropPayload
  } from '@renderer/features/drag-drop/promptHandleDrag'
  import { createPromptDragGhost } from '@renderer/features/drag-drop/promptDragGhost'

  let {
    promptId,
    promptFolderId,
    title,
    isFirstPrompt,
    isLastPrompt,
    onMoveUp,
    onMoveDown,
    onPromptTreeDrop
  }: {
    promptId: string
    promptFolderId: string
    title: string
    isFirstPrompt: boolean
    isLastPrompt: boolean
    onMoveUp: () => void | Promise<void>
    onMoveDown: () => void | Promise<void>
    onPromptTreeDrop: (dropPayload: PromptHandleDropPayload | null) => void | Promise<void>
  } = $props()

  const handleDragStart = (sourcePayload: PromptHandleDragPayload): void => {
    setDraggedPromptRow(sourcePayload)
  }

  const handleDragFinish = ({
    dropPayload
  }: DragFinishResult<PromptHandleDragPayload, PromptHandleDropPayload>): void => {
    clearDraggedPromptRow()
    void onPromptTreeDrop(dropPayload)
  }

  const handleMoveUpClick = () => {
    void onMoveUp()
  }

  const handleMoveDownClick = () => {
    void onMoveDown()
  }

  const preventSidebarButtonMouseFocus = (event: MouseEvent) => {
    if (event.button !== 0) return

    event.preventDefault()
  }

  const getDragHandleOptions = (): DraggableOptions<
    PromptHandleDragPayload,
    PromptHandleDropPayload
  > => ({
    dragType: PROMPT_HANDLE_DRAG_TYPE,
    payload: {
      fromId: promptId,
      sourceFolderId: promptFolderId
    },
    createGhost: () => createPromptDragGhost(title),
    onDragStart: handleDragStart,
    onDragFinish: handleDragFinish
  })

  const dragHandleAction: Action<HTMLButtonElement, unknown> = (node, initialOptions) => {
    const action = draggable<PromptHandleDragPayload, PromptHandleDropPayload>(
      node,
      initialOptions as DraggableOptions<PromptHandleDragPayload, PromptHandleDropPayload>
    )

    return {
      update(nextOptions) {
        action.update(
          nextOptions as DraggableOptions<PromptHandleDragPayload, PromptHandleDropPayload>
        )
      },
      destroy() {
        action.destroy()
      }
    }
  }
</script>

<div class="prompt-editor-sidebar">
  <IconButton
    icon={ChevronUp}
    label="Move prompt up"
    size="sidebar-rail"
    baseVariant="dim"
    class="prompt-editor-sidebar-move-button"
    testId="prompt-move-up"
    disabled={isFirstPrompt}
    onclick={handleMoveUpClick}
    onmousedown={preventSidebarButtonMouseFocus}
  />

  <IconButton
    icon={GripVertical}
    label="Drag prompt"
    size="sidebar-rail"
    baseVariant="dim"
    class="prompt-editor-sidebar-drag-button"
    testId="prompt-drag-handle"
    buttonAction={dragHandleAction}
    buttonActionParameter={getDragHandleOptions()}
    grabCursor={true}
    tabindex={-1}
    onmousedown={preventSidebarButtonMouseFocus}
  />

  <IconButton
    icon={ChevronDown}
    label="Move prompt down"
    size="sidebar-rail"
    baseVariant="dim"
    class="prompt-editor-sidebar-move-button"
    testId="prompt-move-down"
    disabled={isLastPrompt}
    onclick={handleMoveDownClick}
    onmousedown={preventSidebarButtonMouseFocus}
  />
</div>

<style>
  .prompt-editor-sidebar {
    background: var(--ui-card-overlay-surface);
    display: flex;
    flex-direction: column;
    flex: 0 0 36px;
    height: 100%;
    min-height: 0;
    min-width: 0;
    overflow: hidden;
    width: 36px;
  }

  .prompt-editor-sidebar :global(.cthulhuUiIconButton[data-size='sidebar-rail']) {
    /* Transparent borders preserve both separator space and rail sizing. */
    border-bottom-color: transparent;
    transition:
      background-color 120ms ease,
      border-color 50ms ease-out,
      color 120ms ease;
  }

  .prompt-editor-sidebar :global(.prompt-editor-sidebar-move-button) {
    /* Keep each move slot reserved while its arrow fades out. */
    flex: 0 4 40px;
  }

  .prompt-editor-sidebar :global(.prompt-editor-sidebar-drag-button) {
    flex: 1 1 52px;
  }

  .prompt-editor-sidebar :global(.prompt-editor-sidebar-move-button svg) {
    opacity: 0;
    transition: opacity 50ms ease-out;
  }

  .prompt-editor-sidebar:hover :global(.cthulhuUiIconButton[data-size='sidebar-rail']),
  .prompt-editor-sidebar:focus-within
    :global(.cthulhuUiIconButton[data-size='sidebar-rail']) {
    border-bottom-color: var(--ui-neutral-normal-border);
  }

  .prompt-editor-sidebar:hover :global(.prompt-editor-sidebar-move-button svg),
  .prompt-editor-sidebar:focus-within :global(.prompt-editor-sidebar-move-button svg) {
    opacity: 1;
  }

  .prompt-editor-sidebar:focus-within {
    box-shadow: inset 0 0 0 2px var(--ui-neutral-focus-border);
  }
</style>
