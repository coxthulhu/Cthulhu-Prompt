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
    clearPromptEntryDrag,
    startPromptDrag
  } from '@renderer/features/drag-drop/promptEntryDragState.svelte.ts'
  import {
    PROMPT_HANDLE_DRAG_TYPE,
    type PromptHandleDragPayload,
    type PromptHandleDropPayload
  } from '@renderer/features/drag-drop/promptHandleDrag'
  import { createPromptDragGhost } from '@renderer/features/drag-drop/promptDragGhost'

  let {
    promptId,
    promptFolderId,
    contentKind = 'prompt',
    contentLabel = 'prompt',
    title,
    isFirstPrompt,
    isLastPrompt,
    isDragEnabled = true,
    onMoveUp,
    onMoveDown,
    onPromptTreeDrop
  }: {
    promptId: string
    promptFolderId: string
    contentKind?: import('@shared/PromptFolder').PromptFolderContentKind
    contentLabel?: string
    title: string
    isFirstPrompt: boolean
    isLastPrompt: boolean
    isDragEnabled?: boolean
    onMoveUp: () => void | Promise<void>
    onMoveDown: () => void | Promise<void>
    onPromptTreeDrop: (dropPayload: PromptHandleDropPayload | null) => void | Promise<void>
  } = $props()

  const handleDragStart = (sourcePayload: PromptHandleDragPayload): void => {
    startPromptDrag(sourcePayload)
  }

  const handleDragFinish = ({
    dropPayload
  }: DragFinishResult<PromptHandleDragPayload, PromptHandleDropPayload>): void => {
    clearPromptEntryDrag()
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
      sourceFolderId: promptFolderId,
      contentKind
    },
    createGhost: () => createPromptDragGhost(title, contentKind),
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
    label={`Move ${contentLabel} up`}
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
    label={`Drag ${contentLabel}`}
    size="sidebar-rail"
    baseVariant="dim"
    class="prompt-editor-sidebar-drag-button"
    testId="prompt-drag-handle"
    disabled={!isDragEnabled}
    buttonAction={isDragEnabled ? dragHandleAction : undefined}
    buttonActionParameter={isDragEnabled ? getDragHandleOptions() : undefined}
    grabCursor={isDragEnabled}
    tabindex={-1}
    onmousedown={preventSidebarButtonMouseFocus}
  />

  <IconButton
    icon={ChevronDown}
    label={`Move ${contentLabel} down`}
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
    background: var(--ui-card-normal-surface);
    border-right: 1px solid var(--ui-neutral-muted-border);
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    flex: 0 0 32px;
    height: 100%;
    min-height: 0;
    min-width: 0;
    overflow: hidden;
    width: 32px;
  }

  .prompt-editor-sidebar :global(.cthulhuUiIconButton[data-size='sidebar-rail']) {
    /* Transparent borders preserve both separator space and rail sizing. */
    border-bottom-color: transparent;
    transition:
      background-color var(--ui-animation-duration-standard) ease,
      border-color var(--ui-animation-duration-fast) ease-out,
      color var(--ui-animation-duration-standard) ease;
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
    transition: opacity var(--ui-animation-duration-fast) ease-out;
  }

  .prompt-editor-sidebar:hover :global(.cthulhuUiIconButton[data-size='sidebar-rail']),
  .prompt-editor-sidebar:focus-within :global(.cthulhuUiIconButton[data-size='sidebar-rail']) {
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
