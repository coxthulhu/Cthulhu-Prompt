<script lang="ts">
  import DropdownPopupMoreOptions from '@renderer/common/cthulhu-ui/DropdownPopupMoreOptions.svelte'
  import IconButton from '@renderer/common/cthulhu-ui/IconButton.svelte'
  import type { DropdownPopupDetailedItem } from '@renderer/common/cthulhu-ui/DropdownPopupDetailed.svelte'
  import {
    CheckCheck,
    CheckCircle2,
    ChevronDown,
    CircleDashed,
    Hourglass,
    Undo2
  } from 'lucide-svelte'
  import { PromptStatus } from '@shared/Prompt'

  type Props = {
    status: PromptStatus
    onStatusChange: (status: PromptStatus) => void
  }

  let { status, onStatusChange }: Props = $props()

  const statusDetails = $derived.by(() => {
    if (status === PromptStatus.Completed) {
      return { label: 'Completed', icon: CheckCircle2, variant: 'completed' as const }
    }
    if (status === PromptStatus.InProgress) {
      return { label: 'In Progress', icon: Hourglass, variant: 'in-progress' as const }
    }
    return { label: 'Todo', icon: CircleDashed, variant: 'todo' as const }
  })
  const statusOptions = $derived.by<DropdownPopupDetailedItem[]>(() =>
    [
      {
        id: PromptStatus.Todo,
        label: 'Set to Todo',
        detail: 'Move back to active todo status',
        icon: CircleDashed,
        iconClass: 'prompt-editor-status-option-icon-todo',
        testId: 'prompt-status-option-todo'
      },
      {
        id: PromptStatus.InProgress,
        label: 'In Progress',
        detail: 'Mark this prompt as underway',
        icon: Hourglass,
        iconClass: 'prompt-editor-status-option-icon-in-progress',
        testId: 'prompt-status-option-in-progress'
      },
      {
        id: PromptStatus.Completed,
        label: 'Complete',
        detail: 'Move this prompt to completed',
        icon: CheckCircle2,
        iconClass: 'prompt-editor-status-option-icon-completed',
        testId: 'prompt-status-option-completed'
      }
    ].filter((item) => item.id !== status)
  )
  const defaultStatusAction = $derived.by(() =>
    status === PromptStatus.Completed
      ? {
          icon: Undo2,
          label: 'Uncomplete prompt',
          hoverVariant: 'neutral' as const,
          testId: 'prompt-uncomplete-button',
          status: PromptStatus.Todo
        }
      : {
          icon: CheckCheck,
          label: 'Complete prompt',
          hoverVariant: 'success' as const,
          testId: 'prompt-complete-button',
          status: PromptStatus.Completed
        }
  )
  const statusMoreOptionsLabel = $derived(`${defaultStatusAction.label} More Options`)
  const StatusIcon = $derived(statusDetails.icon)

  const handleStatusSelect = (item: DropdownPopupDetailedItem) => {
    onStatusChange(item.id as PromptStatus)
  }
</script>

<div class="prompt-editor-status-control">
  <DropdownPopupMoreOptions
    label={statusMoreOptionsLabel}
    testId="prompt-status-more-options-menu"
    items={statusOptions}
    onselect={handleStatusSelect}
  >
    {#snippet trigger(dropdown)}
      {@const triggerAction = dropdown.triggerAction}
      <span
        use:triggerAction
        class="prompt-editor-status-segmented-control"
      >
        <IconButton
          icon={defaultStatusAction.icon}
          label={defaultStatusAction.label}
          title={defaultStatusAction.label}
          hoverVariant={defaultStatusAction.hoverVariant}
          testId={defaultStatusAction.testId}
          onclick={() => onStatusChange(defaultStatusAction.status)}
          class="prompt-editor-status-default-action"
        />

        <span
          class="prompt-editor-status-selector"
          data-status={statusDetails.variant}
          data-active={dropdown.open ? 'true' : 'false'}
        >
          <button
            type="button"
            class="prompt-editor-status-display"
            data-variant={statusDetails.variant}
            data-testid="prompt-status-pill"
            title={`Change status: ${statusDetails.label}`}
            aria-label={`Change status: ${statusDetails.label}`}
            aria-haspopup={dropdown.ariaHaspopup}
            aria-expanded={dropdown.ariaExpanded}
            onclick={dropdown.toggle}
          >
            <StatusIcon size={14} aria-hidden="true" />
            <span>{statusDetails.label}</span>
          </button>

          <IconButton
            icon={ChevronDown}
            label={statusMoreOptionsLabel}
            title="More Options"
            ariaHaspopup={dropdown.ariaHaspopup}
            ariaExpanded={dropdown.ariaExpanded}
            onclick={dropdown.toggle}
            testId="prompt-status-more-options-button"
            class="prompt-editor-status-more-options"
          />
        </span>
      </span>
    {/snippet}
  </DropdownPopupMoreOptions>
</div>

<style>
  .prompt-editor-status-control {
    align-items: center;
    display: inline-flex;
    flex: 0 0 auto;
    padding-left: 4px;
    padding-right: 16px;
  }

  .prompt-editor-status-segmented-control {
    align-items: stretch;
    display: inline-flex;
  }

  .prompt-editor-status-selector {
    /* Status is communicated by the middle segment's text and icon only. */
    --prompt-editor-status-text: var(--ui-secondary-text);

    align-items: stretch;
    background: transparent;
    border: 1px solid var(--ui-neutral-normal-border);
    border-bottom-right-radius: var(--cthulhu-ui-radius-control);
    border-top-right-radius: var(--cthulhu-ui-radius-control);
    box-sizing: border-box;
    display: inline-flex;
    height: 36px;
    transition:
      background-color 120ms ease,
      border-color 120ms ease;
  }

  .prompt-editor-status-selector[data-status='in-progress'] {
    --prompt-editor-status-text: var(--ui-warning-icon-glyph);
  }

  .prompt-editor-status-selector[data-status='completed'] {
    --prompt-editor-status-text: var(--ui-success-normal-text);
  }

  .prompt-editor-status-selector:hover {
    background: var(--ui-neutral-action-fill);
    border-left-color: var(--ui-neutral-hover-border);
  }

  .prompt-editor-status-selector[data-active='true'] {
    background: var(--ui-neutral-action-hover-fill);
    border-left-color: var(--ui-neutral-hover-border);
  }

  .prompt-editor-status-selector:has(:focus-visible) {
    background: var(--ui-neutral-action-fill);
    border-left-color: var(--ui-neutral-hover-border);
    outline: 2px solid var(--ui-neutral-focus-border);
    outline-offset: 2px;
  }

  :global(
      .prompt-editor-status-default-action.cthulhuUiIconButton[data-hover-variant='success']:hover
    )
    + .prompt-editor-status-selector,
  :global(
      .prompt-editor-status-default-action.cthulhuUiIconButton[data-hover-variant='success']:focus-visible
    )
    + .prompt-editor-status-selector {
    border-left-color: var(--ui-success-muted-hover-border);
  }

  :global(
      .prompt-editor-status-default-action.cthulhuUiIconButton[data-hover-variant='neutral']:hover
    )
    + .prompt-editor-status-selector,
  :global(
      .prompt-editor-status-default-action.cthulhuUiIconButton[data-hover-variant='neutral']:focus-visible
    )
    + .prompt-editor-status-selector {
    border-left-color: var(--ui-neutral-hover-border);
  }

  :global(.prompt-editor-status-default-action.cthulhuUiIconButton) {
    background: transparent;
    border-bottom-right-radius: 0;
    border-right: 0;
    border-top-right-radius: 0;
  }

  .prompt-editor-status-display {
    align-items: center;
    background: transparent;
    border: 0;
    border-right: 1px solid var(--ui-neutral-normal-border);
    border-radius: 0;
    box-sizing: border-box;
    color: var(--prompt-editor-status-text);
    cursor: pointer;
    display: inline-flex;
    flex: 0 0 116px;
    font-family: inherit;
    font-size: 14px;
    font-weight: 500;
    gap: 6px;
    height: 34px;
    justify-content: center;
    padding: 0 4px;
    width: 116px;
  }

  .prompt-editor-status-display:focus-visible {
    outline: none;
  }

  .prompt-editor-status-display :global(svg) {
    flex: 0 0 auto;
  }

  :global(.prompt-editor-status-more-options.cthulhuUiIconButton) {
    background: transparent;
    border: 0;
    border-bottom-left-radius: 0;
    border-top-left-radius: 0;
    height: 34px;
    width: 23px;
  }

  :global(.prompt-editor-status-more-options.cthulhuUiIconButton:hover),
  :global(.prompt-editor-status-more-options.cthulhuUiIconButton:focus-visible) {
    background: transparent;
    outline: none;
  }

  :global(.prompt-editor-status-option-icon-todo) {
    color: var(--ui-secondary-icon-glyph);
  }

  :global(.prompt-editor-status-option-icon-in-progress) {
    color: var(--ui-warning-icon-glyph);
  }

  :global(.prompt-editor-status-option-icon-completed) {
    color: var(--ui-success-normal-text);
  }
</style>
