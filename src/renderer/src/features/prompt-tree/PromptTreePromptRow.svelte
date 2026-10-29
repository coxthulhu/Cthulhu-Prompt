<script lang="ts">
  import type { ComponentType } from 'svelte'
  import type { Action } from 'svelte/action'
  import { draggable } from '@renderer/common/drag-drop/dragDrop.svelte.ts'
  import DropTarget from '@renderer/common/drag-drop/DropTarget.svelte'
  import SelectionIndicator from '@renderer/common/cthulhu-ui/forms/SelectionIndicator.svelte'
  import PromptStatusIndicator from '@renderer/features/prompt-editor/PromptStatusIndicator.svelte'
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
    /** Optional picker action invoked by double-clicking this row. */
    onPromptDoubleClick?: (collectionId: string, promptId: string) => void
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
    onPromptSelect,
    onPromptDoubleClick
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

{#snippet promptButtonContent(isSelected: boolean)}
  <PromptTreeGutter indentCount={promptIndentCount} {isLastRow} />
  <span class="prompt-tree-prompt-content">
    {#if Icon}
      <Icon size={16} class="prompt-tree-row-icon" aria-hidden="true" />
    {/if}
    {#if selectionControl}
      <SelectionIndicator
        control={selectionControl}
        checked={isSelected}
        class="prompt-tree-selection-control"
      />
    {/if}
    <span class="sidebarPromptTreeSettingsLabel prompt-tree-prompt-label min-w-0 truncate text-sm">{promptTitle}</span>
    {#if count !== undefined}
      <span class="prompt-tree-row-count text-xs leading-4 tabular-nums">{count}</span>
    {/if}
  </span>
{/snippet}

{#snippet promptStatusIndicator()}
  <!-- The status accent overlays the row so it does not alter button geometry or interaction. -->
  <PromptStatusIndicator
    {status}
    {isEdited}
    testId="prompt-tree-status-indicator"
    class="prompt-tree-status-indicator"
  />
{/snippet}

{#snippet promptButton(isOver: boolean, isBlocked: boolean)}
  {@const buttonRowState = isOver && Icon ? isBlocked ? 'blocked-over' : 'over' : rowState}
  <button
    use:optionalDraggable={promptDragOptions}
    type="button"
    data-testid={testId ?? collectionPromptTestId(promptId, testIdGroup)}
    data-row-state={buttonRowState}
    data-selection-control={selectionControl}
    data-collection-row={Icon ? 'true' : undefined}
    title={Icon ? promptTitle : undefined}
    aria-current={isActive ? 'true' : undefined}
    aria-pressed={selectionControl === 'copy' || !selectionControl ? undefined : isActive}
    onclick={handlePromptSelect}
    ondblclick={onPromptDoubleClick ? () => onPromptDoubleClick(collectionId, promptId) : undefined}
    class="sidebarPromptTreeSettingsButton"
  >
    {@render promptButtonContent(buttonRowState === 'active')}
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

  .prompt-tree-row-count {
    flex-shrink: 0;
    color: var(--ui-secondary-text);
  }

  :global(.prompt-tree-status-indicator) {
    bottom: 0;
    left: 0;
    pointer-events: none;
    position: absolute;
    top: 0;
    width: 2px;
    z-index: var(--z-raised);
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

  .prompt-tree-prompt-label {
    flex: 1 1 auto;
  }
</style>
