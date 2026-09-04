<script lang="ts">
  import IconButton from '@renderer/common/cthulhu-ui/IconButton.svelte'
  import SimpleSelectorButtonWithIntegratedButton from '@renderer/common/cthulhu-ui/SimpleSelectorButtonWithIntegratedButton.svelte'
  import { promptStatusItems } from './promptStatusPresentation'
  import type { PromptStatus } from '@shared/Prompt'

  /** Current workflow state and its transition callback. */
  type Props = {
    status: PromptStatus
    onStatusChange: (status: PromptStatus) => void
  }

  /** Reactive editor status supplied by its prompt row. */
  let { status, onStatusChange }: Props = $props()

  // Selected metadata supplies the label and optional quick transitions.
  const selectedStatusItem = $derived(promptStatusItems.find((item) => item.id === status)!)
  // Archive remains available through the separate archive action.
  const settableStatusItems = $derived(
    promptStatusItems.filter((item) => item.id !== status && !item.omitFromMenu)
  )
  // Each status explicitly declares its forward and backward quick actions.
  const forwardStatusAction = $derived(selectedStatusItem.forwardAction ?? null)
  const backwardStatusAction = $derived(selectedStatusItem.backwardAction ?? null)
</script>

<div class="prompt-editor-status-control">
  <SimpleSelectorButtonWithIntegratedButton
    class="prompt-editor-status-segmented-control"
    label="Change status"
    items={settableStatusItems}
    selectedItem={selectedStatusItem}
    showIcon
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
