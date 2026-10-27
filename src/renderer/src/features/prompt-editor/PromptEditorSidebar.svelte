<script lang="ts">
  import { getPromptLocation } from '@renderer/data/Mutations/PromptLocationMutations'
  import { getPromptNavigationContext } from '@renderer/app/PromptNavigationContext.svelte.ts'
  import type { Action } from 'svelte/action'
  import IconButton from '@renderer/common/cthulhu-ui/buttons/IconButton.svelte'
  import { GripVertical } from 'lucide-svelte'
  import {
    draggable,
    type DragFinishResult,
    type DraggableOptions
  } from '@renderer/common/drag-drop/dragDrop.svelte.ts'
  import { startPromptDrag } from '@renderer/features/prompt-drag-drop/promptEntryDragState.svelte.ts'
  import {
    PROMPT_HANDLE_DRAG_TYPE,
    type PromptHandleDragPayload,
    type PromptHandleDropPayload
  } from '@renderer/features/prompt-drag-drop/promptHandleDrag'
  import { createPromptDragGhost } from '@renderer/features/prompt-drag-drop/promptDragGhost'

  let {
    promptId,
    promptCollectionId,
    contentKind = 'prompt',
    contentLabel = 'prompt',
    title,
    isDragEnabled = true,
    onPromptTreeDrop
  }: {
    promptId: string
    promptCollectionId: string
    contentKind?: import('@shared/domain/prompt-collection/PromptCollection').PromptCollectionContentKind
    contentLabel?: string
    title: string
    isDragEnabled?: boolean
    onPromptTreeDrop: (dropPayload: PromptHandleDropPayload | null) => void | Promise<void>
  } = $props()

  /** Shared tree-click state identifies the editor rail to highlight. */
  const promptNavigation = getPromptNavigationContext()
  /** Replay only the background layer so rail controls retain their DOM and focus. */
  const navigationHighlightGeneration = $derived(
    promptNavigation.navigationHighlight?.promptId === promptId
      ? promptNavigation.navigationHighlight.generation
      : null
  )

  const handleDragStart = (sourcePayload: PromptHandleDragPayload): void => {
    startPromptDrag(sourcePayload)
  }

  const handleDragFinish = ({
    dropPayload
  }: DragFinishResult<PromptHandleDragPayload, PromptHandleDropPayload>): void => {
    void onPromptTreeDrop(dropPayload)
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
      location: getPromptLocation(promptCollectionId, promptId),
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

<div class="editor-card-rail prompt-editor-sidebar">
  <!-- One background layer covers the full-height drag handle. -->
  {#key navigationHighlightGeneration}
    <span
      class="prompt-editor-sidebar-highlight"
      data-navigation-highlight={navigationHighlightGeneration === null ? undefined : 'true'}
      data-navigation-highlight-generation={navigationHighlightGeneration ?? undefined}
      data-testid="prompt-sidebar-highlight"
      aria-hidden="true"
    ></span>
  {/key}
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
</div>

<style>
  /* The muted violet wash sits behind the drag handle without intercepting input. */
  .prompt-editor-sidebar-highlight {
    position: absolute;
    inset: 0;
    pointer-events: none;
    background: var(--ui-ghost-surface);
  }

  .prompt-editor-sidebar-highlight[data-navigation-highlight='true'] {
    animation: prompt-editor-navigation-highlight 1000ms linear;
  }

  /* 50ms fade in, 500ms hold, then 450ms fade out. */
  @keyframes prompt-editor-navigation-highlight {
    0%,
    100% {
      background: var(--ui-ghost-surface);
    }
    5%,
    55% {
      background: var(--ui-accent-action-hover-fill);
    }
  }

  .prompt-editor-sidebar :global(.cthulhuUiIconButton[data-size='sidebar-rail']) {
    position: relative;
    z-index: var(--z-raised);
    /* Transparent borders preserve both separator space and rail sizing. */
    border-bottom-color: transparent;
    transition:
      background-color var(--ui-animation-duration-standard) ease,
      border-color var(--ui-animation-duration-fast) ease-out,
      color var(--ui-animation-duration-standard) ease;
  }

  .prompt-editor-sidebar :global(.prompt-editor-sidebar-drag-button) {
    flex: 1 1 52px;
  }

  .prompt-editor-sidebar:hover :global(.cthulhuUiIconButton[data-size='sidebar-rail']),
  .prompt-editor-sidebar:focus-within :global(.cthulhuUiIconButton[data-size='sidebar-rail']) {
    border-bottom-color: var(--ui-neutral-normal-border);
  }

  .prompt-editor-sidebar:focus-within {
    box-shadow: inset 0 0 0 2px var(--ui-neutral-focus-border);
  }
</style>
