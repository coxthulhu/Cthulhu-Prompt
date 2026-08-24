<script lang="ts">
  import IconButton from '@renderer/common/cthulhu-ui/IconButton.svelte'
  import SimpleSelectorButtonWithIntegratedButton from '@renderer/common/cthulhu-ui/SimpleSelectorButtonWithIntegratedButton.svelte'
  import type { SimpleSelectorButtonItem } from '@renderer/common/cthulhu-ui/SimpleSelectorButton.svelte'
  import { Check, CircleDashed, Play, Undo2 } from 'lucide-svelte'
  import { PromptStatus } from '@shared/Prompt'

  type Props = {
    status: PromptStatus
    onStatusChange: (status: PromptStatus) => void
  }

  let { status, onStatusChange }: Props = $props()

  const statusItems: SimpleSelectorButtonItem[] = [
    {
      id: PromptStatus.Todo,
      label: 'Todo',
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
      icon: Play,
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
      icon: Check,
      iconClass: 'prompt-editor-status-option-icon-completed',
      tone: 'success',
      variant: 'completed',
      testId: 'prompt-status-option-completed'
    }
  ]

  const selectedStatusItem = $derived(statusItems.find((item) => item.id === status)!)
  // The menu only offers statuses that would change the prompt's current status.
  const settableStatusItems = $derived(statusItems.filter((item) => item.id !== status))
  // A quick status action describes one optional outer segment of the status control.
  type QuickStatusAction = {
    icon: typeof Check
    label: string
    hoverVariant: 'neutral' | 'success'
    testId: string
    status: PromptStatus
  }
  // The forward action completes any active prompt and disappears once it is completed.
  const forwardStatusAction = $derived.by<QuickStatusAction | null>(() =>
    status === PromptStatus.Completed
      ? null
      : {
          icon: Check,
          label: 'Complete prompt',
          hoverVariant: 'success',
          testId: 'prompt-complete-button',
          status: PromptStatus.Completed
        }
  )
  // The backward action returns In Progress or Completed prompts directly to Todo.
  const backwardStatusAction = $derived.by<QuickStatusAction | null>(() => {
    if (status === PromptStatus.Todo) return null
    return {
      icon: Undo2,
      label: status === PromptStatus.Completed ? 'Uncomplete prompt' : 'Set prompt to Todo',
      hoverVariant: 'neutral',
      testId:
        status === PromptStatus.Completed
          ? 'prompt-uncomplete-button'
          : 'prompt-previous-status-button',
      status: PromptStatus.Todo
    }
  })
</script>

<div class="prompt-editor-status-control">
  <SimpleSelectorButtonWithIntegratedButton
    class="prompt-editor-status-segmented-control"
    label="Change status"
    items={settableStatusItems}
    selectedItem={selectedStatusItem}
    showIcon
    valueWidth="116px"
    moreOptionsLabel="Change status More Options"
    menuTestId="prompt-status-more-options-menu"
    testId="prompt-status-pill"
    moreOptionsTestId="prompt-status-more-options-button"
    showIntegratedButton={backwardStatusAction !== null}
    showTrailingIntegratedButton={forwardStatusAction !== null}
    onselect={(item) => onStatusChange(item.id as PromptStatus)}
  >
    {#snippet integratedButton()}
      {#if backwardStatusAction}
        <IconButton
          icon={backwardStatusAction.icon}
          label={backwardStatusAction.label}
          title={backwardStatusAction.label}
          hoverVariant={backwardStatusAction.hoverVariant}
          testId={backwardStatusAction.testId}
          onclick={() => onStatusChange(backwardStatusAction.status)}
          class="prompt-editor-status-backward-action"
        />
      {/if}
    {/snippet}
    {#snippet trailingIntegratedButton()}
      {#if forwardStatusAction}
        <IconButton
          icon={forwardStatusAction.icon}
          label={forwardStatusAction.label}
          title={forwardStatusAction.label}
          hoverVariant={forwardStatusAction.hoverVariant}
          testId={forwardStatusAction.testId}
          onclick={() => onStatusChange(forwardStatusAction.status)}
          class="prompt-editor-status-forward-action"
        />
      {/if}
    {/snippet}
  </SimpleSelectorButtonWithIntegratedButton>
</div>

<style>
  .prompt-editor-status-control {
    align-items: center;
    display: inline-flex;
    flex: 0 0 auto;
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
