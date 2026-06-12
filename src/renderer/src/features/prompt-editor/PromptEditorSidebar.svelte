<script lang="ts">
  import type { Action } from 'svelte/action'
  import FlatIconButton from '@renderer/common/cthulhu-ui/FlatIconButton.svelte'
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
  <FlatIconButton
    icon={ChevronUp}
    label="Move prompt up"
    size="sidebar-rail"
    variant="dim-sidebar"
    testId="prompt-move-up"
    disabled={isFirstPrompt}
    onclick={handleMoveUpClick}
  />

  <FlatIconButton
    icon={GripVertical}
    label="Drag prompt"
    size="sidebar-rail"
    variant="dim-sidebar"
    iconClass="stroke-[2.5]"
    testId="prompt-drag-handle"
    buttonAction={dragHandleAction}
    buttonActionParameter={getDragHandleOptions()}
    grabCursor={true}
  />

  <FlatIconButton
    icon={ChevronDown}
    label="Move prompt down"
    size="sidebar-rail"
    variant="dim-sidebar"
    testId="prompt-move-down"
    disabled={isLastPrompt}
    onclick={handleMoveDownClick}
  />
</div>

<style>
  .prompt-editor-sidebar {
    background: var(--ui-flat-card-overlay-surface);
    display: grid;
    flex: 0 0 38px;
    grid-template-rows: 44px minmax(44px, 1fr) 44px;
    height: 100%;
    min-height: 156px;
    min-width: 0;
    width: 38px;
  }

  .prompt-editor-sidebar:focus-within {
    box-shadow: inset 0 0 0 2px var(--ui-flat-neutral-focus-border);
  }
</style>
