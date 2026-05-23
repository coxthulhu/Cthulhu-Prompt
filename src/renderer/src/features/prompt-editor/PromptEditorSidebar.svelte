<script lang="ts">
  import type { Action } from 'svelte/action'
  import IconOnlyButton from '@renderer/common/cthulhu-ui/IconOnlyButton.svelte'
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
  <IconOnlyButton
    icon={ChevronUp}
    label="Move prompt up"
    variant="dim-border"
    size="rail"
    testId="prompt-move-up"
    disabled={isFirstPrompt}
    onclick={handleMoveUpClick}
  />

  <IconOnlyButton
    icon={GripVertical}
    label="Drag prompt"
    variant="dim-border"
    size="rail-fill"
    iconClass="stroke-[2.5]"
    testId="prompt-drag-handle"
    buttonAction={dragHandleAction}
    buttonActionParameter={getDragHandleOptions()}
    grabCursor={true}
  />

  <IconOnlyButton
    icon={ChevronDown}
    label="Move prompt down"
    variant="dim-border"
    size="rail"
    testId="prompt-move-down"
    disabled={isLastPrompt}
    onclick={handleMoveDownClick}
  />
</div>

<style>
  .prompt-editor-sidebar {
    display: grid;
    flex: 0 0 28px;
    gap: 6px;
    grid-template-rows: 28px minmax(0, 1fr) 28px;
    height: 100%;
    min-height: 136px;
    width: 28px;
  }
</style>
