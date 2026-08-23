<script lang="ts">
  import { Check, Copy } from 'lucide-svelte'
  import { draggable } from '@renderer/features/drag-drop/dragDrop.svelte.ts'
  import PromptDropTarget from '@renderer/features/drag-drop/PromptDropTarget.svelte'
  import type { PromptStatus } from '@shared/Prompt'
  import { getPromptNavigationContext } from '@renderer/app/PromptNavigationContext.svelte.ts'
  import PromptTreeGutter from './PromptTreeGutter.svelte'
  import { folderPromptTestId } from './promptTreeTestIds'
  import type { PromptRowDragOptions, PromptRowDropOptions } from './promptTreeRowOptions'

  // Optional control displayed before a prompt label when the row is reused by a picker.
  type SelectionControl = 'checkbox' | 'radio' | 'copy'

  type Props = {
    folderId: string
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
    onPromptSelect: (folderId: string, promptId: string) => void
  }

  let {
    folderId,
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

  /** Shared navigation state identifies direct tree clicks that should replay this row's accent. */
  const promptNavigation = getPromptNavigationContext()
  /** Matching click generation remounts the indicator and restarts its CSS animation. */
  const navigationHighlightGeneration = $derived(
    promptNavigation.navigationHighlight?.promptId === promptId
      ? promptNavigation.navigationHighlight.generation
      : null
  )

  const handlePromptSelect = (event: MouseEvent) => {
    onPromptSelect(folderId, promptId)

    const button = event.currentTarget
    if (button instanceof HTMLButtonElement) {
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
</script>

{#snippet promptButtonContent()}
  <PromptTreeGutter indentCount={promptIndentCount} {isLastRow} />
  <span class="prompt-tree-prompt-content">
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
    <span class="sidebarPromptTreeSettingsLabel prompt-tree-prompt-label">{promptTitle}</span>
  </span>
{/snippet}

{#snippet promptStatusIndicator()}
  <!-- The status accent overlays the row so it does not alter button geometry or interaction. -->
  {#key navigationHighlightGeneration}
    <span
      class="prompt-tree-status-indicator"
      data-status={status}
      data-edited={isEdited ? 'true' : 'false'}
      data-navigation-highlight={navigationHighlightGeneration === null ? undefined : 'true'}
      data-navigation-highlight-generation={navigationHighlightGeneration ?? undefined}
      data-testid="prompt-tree-status-indicator"
      aria-hidden="true"
    ></span>
  {/key}
{/snippet}

{#snippet promptButton()}
  <button
    type="button"
    data-testid={folderPromptTestId(promptId)}
    data-row-state={rowState}
    data-selection-control={selectionControl}
    aria-current={isActive ? 'true' : undefined}
    aria-pressed={selectionControl === 'copy' || !selectionControl ? undefined : isActive}
    onclick={handlePromptSelect}
    class="sidebarPromptTreeSettingsButton"
  >
    {@render promptButtonContent()}
  </button>
{/snippet}

{#if getPromptDroppableOptions && promptDragOptions}
  <PromptDropTarget
    getOptions={getPromptDroppableOptions}
    class="sidebarPromptTreeSettingsRow"
    style={rowStyle}
    data-first-tree-row={isFirstTreeRow ? 'true' : undefined}
  >
    {@render promptStatusIndicator()}
    <button
      use:draggable={promptDragOptions}
      type="button"
      data-testid={folderPromptTestId(promptId)}
      data-row-state={rowState}
      data-selection-control={selectionControl}
      aria-current={isActive ? 'true' : undefined}
      aria-pressed={selectionControl === 'copy' || !selectionControl ? undefined : isActive}
      onclick={handlePromptSelect}
      class="sidebarPromptTreeSettingsButton"
    >
      {@render promptButtonContent()}
    </button>
  </PromptDropTarget>
{:else}
  <div
    class="sidebarPromptTreeSettingsRow"
    style={rowStyle}
    data-first-tree-row={isFirstTreeRow ? 'true' : undefined}
  >
    {@render promptStatusIndicator()}
    {@render promptButton()}
  </div>
{/if}

<style>
  .prompt-tree-prompt-content {
    align-items: center;
    display: flex;
    gap: 8px;
    min-width: 0;
  }

  .sidebarPromptTreeSettingsRow {
    position: relative;
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
    z-index: 1;
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

  .prompt-tree-status-indicator[data-navigation-highlight='true'] {
    animation: prompt-tree-navigation-highlight 740ms linear;
  }

  @keyframes prompt-tree-navigation-highlight {
    0% {
      background: var(--prompt-status-indicator-color);
      visibility: visible;
    }
    16.2162%,
    83.7838% {
      background: var(--ui-accent-strong-border);
      visibility: visible;
    }
    100% {
      background: var(--prompt-status-indicator-color);
      visibility: visible;
    }
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
