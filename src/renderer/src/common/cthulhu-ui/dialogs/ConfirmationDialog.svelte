<script lang="ts">
  import { Trash2 } from 'lucide-svelte'
  import type { ComponentType } from 'svelte'
  import Dialog from '@renderer/common/cthulhu-ui/dialogs/Dialog.svelte'
  import SelectionIndicator from '@renderer/common/cthulhu-ui/forms/SelectionIndicator.svelte'

  /** Shared confirmation with an optional required acknowledgement. */
  type Props = {
    open?: boolean
    title: string
    description: string
    confirmText: string
    variant?: 'destructive' | 'informational'
    icon?: ComponentType
    closeOnOutsideClick?: boolean
    /** Shows the red acknowledgement section and gates confirmation when supplied. */
    confirmationText?: string
    confirmTestId?: string
    oncancel?: () => void
    onconfirm?: () => void
  }

  /** Caller-provided dialog content and actions. */
  let {
    open = $bindable(false),
    title,
    description,
    confirmText,
    variant = 'destructive',
    icon = Trash2,
    closeOnOutsideClick = true,
    confirmationText,
    confirmTestId,
    oncancel,
    onconfirm
  }: Props = $props()

  /** Whether the user has acknowledged this opening of the dialog. */
  let acknowledged = $state(false)

  // Side effect: require a fresh acknowledgement after the dialog closes.
  $effect(() => {
    if (!open) acknowledged = false
  })
</script>

<!-- Shared confirmation appearance and optional destructive-action acknowledgement. -->
<Dialog
  bind:open
  class="w-full max-w-[520px]"
  {icon}
  {title}
  submitText={confirmText}
  submitIcon={icon}
  submitDisabled={!!confirmationText && !acknowledged}
  submitVariant={variant === 'destructive' ? 'danger' : 'accent'}
  submitTestId={confirmTestId}
  showSeparators={confirmationText || variant === 'informational' ? 'hidden' : false}
  {closeOnOutsideClick}
  scrollBody
  {oncancel}
  onsubmit={onconfirm}
>
  <div
    class="cthulhuUiConfirmationDialogContent"
    data-compact={variant === 'destructive' && !confirmationText}
  >
    <p class="cthulhuUiConfirmationDialogMessage text-base">{description}</p>
    {#if confirmationText}
      <label class="cthulhuUiConfirmationDialogAcknowledgement text-base">
        <span class="cthulhuUiConfirmationDialogCheckbox">
          <input
            class="cthulhuUiConfirmationDialogCheckboxInput"
            type="checkbox"
            bind:checked={acknowledged}
          />
          <SelectionIndicator
            control="checkbox"
            checked={acknowledged}
            variant="danger"
            class="cthulhuUiConfirmationDialogCheckboxMark"
          />
        </span>
        <span>{confirmationText}</span>
      </label>
    {/if}
  </div>
</Dialog>

<style>
  .cthulhuUiConfirmationDialogContent {
    display: grid;
    gap: 20px;
    min-width: 0;
    padding: 12px;
  }

  .cthulhuUiConfirmationDialogContent[data-compact='true'] {
    padding: 0 12px 4px;
  }

  .cthulhuUiConfirmationDialogMessage {
    color: var(--ui-normal-text);
    min-width: 0;
  }

  .cthulhuUiConfirmationDialogAcknowledgement {
    display: flex;
    align-items: flex-start;
    gap: 12px;
    padding: 8px 16px;
    border: 1px solid var(--ui-danger-muted-border);
    border-radius: 8px;
    background: var(--ui-danger-normal-surface);
    color: var(--ui-normal-text);
  }

  .cthulhuUiConfirmationDialogCheckbox {
    position: relative;
    flex: 0 0 17px;
    height: 17px;
    margin-top: 2px;
  }

  .cthulhuUiConfirmationDialogCheckboxInput {
    position: absolute;
    inset: 0;
    width: 17px;
    height: 17px;
    opacity: 0;
    cursor: pointer;
  }

  /* The native input above the mark receives pointer input. */
  :global(.cthulhuUiConfirmationDialogCheckboxMark) {
    pointer-events: none;
  }

  .cthulhuUiConfirmationDialogCheckboxInput:focus-visible + :global(.cthulhuUiConfirmationDialogCheckboxMark) {
    outline: 2px solid var(--ui-danger-strong-border);
    outline-offset: 2px;
  }
</style>
