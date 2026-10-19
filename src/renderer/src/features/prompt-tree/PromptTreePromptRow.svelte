<script lang="ts">
  import type { ComponentType } from 'svelte'
  import type { Action } from 'svelte/action'
  import { Check, Copy } from 'lucide-svelte'
  import { draggable } from '@renderer/common/drag-drop/dragDrop.svelte.ts'
  import DropTarget from '@renderer/common/drag-drop/DropTarget.svelte'
  import type { PromptStatus } from '@shared/domain/prompt/Prompt'
  import PromptTreeGutter from './PromptTreeGutter.svelte'
  import { collectionPromptTestId } from './promptTreeTestIds'
  import type { PromptRowDragOptions, PromptRowDropOptions } from './promptTreeRowOptions'

  // Optional control displayed before a prompt label when the row is reused by a picker.
  type SelectionControl = 'checkbox' | 'radio' | 'copy'

  type Props = {
    /** Overrides prompt identity when this row represents a collection. */
    testId?: string
    /** Optional collection icon before the row label. */
    icon?: ComponentType
    /** Optional content count at the end of a collection row. */
    count?: number
    /** Status or template namespace used by this reusable row. */
    testIdGroup?: import('./promptTreeTestIds').PromptTreeTestIdGroup
    collectionId: string
    promptId: string
    promptTitle: string
    status?: PromptStatus
    // Whether this prompt has been edited during the current renderer session.
    isEdited?: boolean
    isActive: boolean
    isDragging: boolean
    isPromptDragActive: boolean
    indentCount?: number
    isLastRow?: boolean
    /** Whether this prompt owns the unique tree-start prompt boundary. */
    isFirstTreeRow?: boolean
    selectionControl?: SelectionControl
    getPromptDroppableOptions?: () => PromptRowDropOptions
    promptDragOptions?: PromptRowDragOptions
    onPromptSelect: (collectionId: string, promptId: string) => void
  }

  let {
    testId,
    icon: Icon,
    count,
    testIdGroup = 'template',
    collectionId,
    promptId,
    promptTitle,
    status,
    isEdited = false,
    isActive,
    isDragging,
    isPromptDragActive,
    indentCount = 0,
    isLastRow = false,
    isFirstTreeRow = false,
    selectionControl,
    getPromptDroppableOptions,
    promptDragOptions,
    onPromptSelect
  }: Props = $props()

  const handlePromptSelect = (event: MouseEvent) => {
    onPromptSelect(collectionId, promptId)

    const button = event.currentTarget
    if (event.detail !== 0 && button instanceof HTMLButtonElement) {
      button.blur()
    }
  }

  const rowState = $derived(
    isDragging
      ? 'dragging'
      : isActive
        ? isPromptDragActive
          ? 'drag-active'
          : 'active'
        : isPromptDragActive
          ? 'drag-idle'
          : 'idle'
  )
  const promptIndentCount = $derived(indentCount)
  const PROMPT_TREE_INDENT_WIDTH_PX = 12
  const rowStyle = $derived(
    `--prompt-tree-indent-count:${promptIndentCount}; --prompt-tree-indent-width:${PROMPT_TREE_INDENT_WIDTH_PX}px;`
  )

  /** Registers dragging only for rows that supply a drag source. */
  const optionalDraggable: Action<HTMLButtonElement, PromptRowDragOptions | undefined> = (
    node,
    initialOptions
  ) => {
    /** Drag registration follows changes without replacing the row button. */
    let action = initialOptions ? draggable(node, initialOptions) : undefined
    return {
      /** Updates the drag source when the virtual row's content changes. */
      update(options) {
        if (options) {
          if (action) action.update(options)
          else action = draggable(node, options)
        } else {
          action?.destroy()
          action = undefined
        }
      },
      /** Releases pointer handlers when the row unmounts. */
      destroy() {
        action?.destroy()
      }
    }
  }
</script>

{#snippet promptButtonContent()}
  <PromptTreeGutter indentCount={promptIndentCount} {isLastRow} />
  <span class="prompt-tree-prompt-content">
    {#if Icon}
      <Icon size={16} class="prompt-tree-row-icon" aria-hidden="true" />
    {/if}
    {#if selectionControl}
      <span
        class="prompt-tree-selection-control"
        data-control={selectionControl}
        aria-hidden="true"
      >
        {#if selectionControl === 'checkbox'}
          <Check size={13} />
        {:else if selectionControl === 'copy'}
          <Copy size={16} />
        {/if}
      </span>
    {/if}
    <span class="sidebarPromptTreeSettingsLabel text-sm prompt-tree-prompt-label">{promptTitle}</span>
    {#if count !== undefined}
      <span class="prompt-tree-row-count text-xs leading-4 tabular-nums">{count}</span>
    {/if}
  </span>
{/snippet}

{#snippet promptStatusIndicator()}
  <!-- The status accent overlays the row so it does not alter button geometry or interaction. -->
  <span
    class="prompt-tree-status-indicator"
    data-status={status}
    data-edited={isEdited ? 'true' : 'false'}
    data-testid="prompt-tree-status-indicator"
    aria-hidden="true"
  ></span>
{/snippet}

{#snippet promptButton(isOver: boolean, isBlocked: boolean)}
  <button
    use:optionalDraggable={promptDragOptions}
    type="button"
    data-testid={testId ?? collectionPromptTestId(promptId, testIdGroup)}
    data-row-state={isOver && Icon ? isBlocked ? 'blocked-over' : 'over' : rowState}
    data-selection-control={selectionControl}
    data-collection-row={Icon ? 'true' : undefined}
    title={Icon ? promptTitle : undefined}
    aria-current={isActive ? 'true' : undefined}
    aria-pressed={selectionControl === 'copy' || !selectionControl ? undefined : isActive}
    onclick={handlePromptSelect}
    class="sidebarPromptTreeSettingsButton"
  >
    {@render promptButtonContent()}
  </button>
{/snippet}

<!-- Shared tree rows also support collection pickers that accept drops without dragging. -->
<DropTarget
  getOptions={getPromptDroppableOptions}
  class="sidebarPromptTreeSettingsRow relative"
  style={rowStyle}
  data-first-tree-row={isFirstTreeRow ? 'true' : undefined}
>
  {#snippet children({ isOver, isBlocked })}
    {@render promptStatusIndicator()}
    {@render promptButton(isOver, isBlocked)}
  {/snippet}
</DropTarget>

<style>
  .prompt-tree-prompt-content {
    align-items: center;
    display: flex;
    gap: 8px;
    min-width: 0;
  }

  .sidebarPromptTreeSettingsButton[data-collection-row='true'] {
    padding-right: 12px;
  }

  .prompt-tree-prompt-content :global(.prompt-tree-row-icon) {
    flex-shrink: 0;
    color: var(--ui-secondary-icon-glyph);
  }

  .sidebarPromptTreeSettingsButton[data-row-state='over'] {
    background: var(--ui-info-normal-surface);
    color: var(--ui-normal-text);
  }

  .sidebarPromptTreeSettingsButton[data-row-state='blocked-over'] {
    background: var(--ui-neutral-emphasis-surface);
    color: var(--ui-normal-text);
  }

  .prompt-tree-row-count {
    flex-shrink: 0;
    color: var(--ui-secondary-text);
  }

  .prompt-tree-status-indicator {
    --prompt-status-indicator-color: transparent;
    background: var(--prompt-status-indicator-color);
    bottom: 0;
    left: 0;
    pointer-events: none;
    position: absolute;
    top: 0;
    visibility: hidden;
    width: 2px;
    z-index: var(--z-raised);
  }

  .prompt-tree-status-indicator[data-edited='true'] {
    --prompt-status-indicator-color: var(--ui-info-strong-border);
    color: var(--prompt-status-indicator-color);
    visibility: visible;
  }

  .prompt-tree-status-indicator[data-status='InProgress'] {
    --prompt-status-indicator-color: var(--ui-warning-icon-glyph);
    color: var(--prompt-status-indicator-color);
    visibility: visible;
  }

  .prompt-tree-status-indicator[data-status='Completed'] {
    --prompt-status-indicator-color: var(--ui-success-normal-text);
    color: var(--prompt-status-indicator-color);
    visibility: visible;
  }

  .prompt-tree-status-indicator[data-status='Archived'] {
    --prompt-status-indicator-color: var(--ui-secondary-icon-glyph);
    color: var(--prompt-status-indicator-color);
    visibility: visible;
  }

  .sidebarPromptTreeSettingsButton[data-selection-control] {
    border-radius: var(--cthulhu-ui-radius-control);
    cursor: pointer;
    padding-right: 14px;
  }

  .sidebarPromptTreeSettingsButton[data-selection-control][data-row-state='active'] {
    background: var(--ui-accent-action-fill);
  }

  .sidebarPromptTreeSettingsButton[data-selection-control][data-row-state='active']:hover {
    background: var(--ui-accent-action-hover-fill);
  }

  .prompt-tree-selection-control {
    align-items: center;
    box-sizing: border-box;
    display: inline-flex;
    flex: 0 0 auto;
    height: 17px;
    justify-content: center;
    width: 17px;
  }

  .prompt-tree-selection-control[data-control='checkbox'] {
    border: 1px solid var(--ui-neutral-normal-border);
    border-radius: 4px;
    color: transparent;
    transition:
      background-color var(--ui-animation-duration-fast) ease-out,
      border-color var(--ui-animation-duration-fast) ease-out,
      color var(--ui-animation-duration-fast) ease-out;
  }

  .prompt-tree-selection-control[data-control='radio'] {
    border: 1px solid var(--ui-neutral-normal-border);
    border-radius: 50%;
  }

  .prompt-tree-selection-control[data-control='radio']::after {
    background: transparent;
    border-radius: 50%;
    content: '';
    height: 9px;
    width: 9px;
  }

  .sidebarPromptTreeSettingsButton[data-row-state='active']
    .prompt-tree-selection-control[data-control='radio'] {
    border-color: var(--ui-accent-normal-border);
  }

  .sidebarPromptTreeSettingsButton[data-row-state='active']
    .prompt-tree-selection-control[data-control='radio']::after {
    background: var(--ui-normal-text);
  }

  .sidebarPromptTreeSettingsButton[data-row-state='active']
    .prompt-tree-selection-control[data-control='checkbox'] {
    background: var(--ui-accent-action-hover-fill);
    border-color: var(--ui-accent-normal-border);
    color: var(--ui-normal-text);
  }

  .prompt-tree-selection-control[data-control='copy'] {
    color: var(--ui-secondary-icon-glyph);
  }

  .prompt-tree-prompt-label {
    flex: 1 1 auto;
  }
</style>
