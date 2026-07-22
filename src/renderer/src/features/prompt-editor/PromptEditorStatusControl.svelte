<script lang="ts">
  import IconButton from '@renderer/common/cthulhu-ui/IconButton.svelte'
  import SimpleSelectorButtonWithIntegratedButton from '@renderer/common/cthulhu-ui/SimpleSelectorButtonWithIntegratedButton.svelte'
  import type { SimpleSelectorButtonItem } from '@renderer/common/cthulhu-ui/SimpleSelectorButton.svelte'
  import { CheckCheck, CheckCircle2, CircleDashed, Hourglass, Undo2 } from 'lucide-svelte'
  import { PromptStatus } from '@shared/Prompt'

  type Props = {
    status: PromptStatus
    onStatusChange: (status: PromptStatus) => void
  }

  let { status, onStatusChange }: Props = $props()

  const statusItems: SimpleSelectorButtonItem[] = [
    {
      id: PromptStatus.Todo,
      label: 'Set to Todo',
      selectedLabel: 'Todo',
      detail: 'Move back to active todo status',
      icon: CircleDashed,
      iconClass: 'prompt-editor-status-option-icon-todo',
      variant: 'todo',
      testId: 'prompt-status-option-todo'
    },
    {
      id: PromptStatus.InProgress,
      label: 'In Progress',
      detail: 'Mark this prompt as underway',
      icon: Hourglass,
      iconClass: 'prompt-editor-status-option-icon-in-progress',
      tone: 'warning',
      variant: 'in-progress',
      testId: 'prompt-status-option-in-progress'
    },
    {
      id: PromptStatus.Completed,
      label: 'Complete',
      selectedLabel: 'Completed',
      detail: 'Move this prompt to completed',
      icon: CheckCircle2,
      iconClass: 'prompt-editor-status-option-icon-completed',
      tone: 'success',
      variant: 'completed',
      testId: 'prompt-status-option-completed'
    }
  ]

  const selectedStatusItem = $derived(statusItems.find((item) => item.id === status)!)
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
</script>

<div class="prompt-editor-status-control">
  <SimpleSelectorButtonWithIntegratedButton
    class="prompt-editor-status-segmented-control"
    label="Change status"
    items={statusItems}
    selectedItem={selectedStatusItem}
    showIcon
    valueWidth="116px"
    moreOptionsLabel={statusMoreOptionsLabel}
    menuTestId="prompt-status-more-options-menu"
    testId="prompt-status-pill"
    moreOptionsTestId="prompt-status-more-options-button"
    onselect={(item) => onStatusChange(item.id as PromptStatus)}
  >
    {#snippet integratedButton()}
      <IconButton
        icon={defaultStatusAction.icon}
        label={defaultStatusAction.label}
        title={defaultStatusAction.label}
        hoverVariant={defaultStatusAction.hoverVariant}
        testId={defaultStatusAction.testId}
        onclick={() => onStatusChange(defaultStatusAction.status)}
        class="prompt-editor-status-default-action"
      />
    {/snippet}
  </SimpleSelectorButtonWithIntegratedButton>
</div>

<style>
  .prompt-editor-status-control {
    align-items: center;
    display: inline-flex;
    flex: 0 0 auto;
    padding-left: 4px;
    padding-right: 16px;
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
