<script lang="ts">
  import { Check, Trash2 } from 'lucide-svelte'
  import type { ComponentType } from 'svelte'
  import Dialog from '@renderer/common/cthulhu-ui/dialogs/Dialog.svelte'

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
          <span class="cthulhuUiConfirmationDialogCheckboxMark" aria-hidden="true">
            <Check size={13} />
          </span>
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
    margin: 0;
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
    margin: 0;
    opacity: 0;
    cursor: pointer;
  }

  .cthulhuUiConfirmationDialogCheckboxMark {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    box-sizing: border-box;
    width: 17px;
    height: 17px;
    border: 1px solid var(--ui-neutral-normal-border);
    border-radius: 4px;
    color: transparent;
    pointer-events: none;
    transition:
      background-color var(--ui-animation-duration-fast) ease-out,
      border-color var(--ui-animation-duration-fast) ease-out,
      color var(--ui-animation-duration-fast) ease-out;
  }

  .cthulhuUiConfirmationDialogCheckboxInput:checked + .cthulhuUiConfirmationDialogCheckboxMark {
    background: var(--ui-danger-selection-fill);
    border-color: var(--ui-danger-selection-border);
    color: var(--ui-normal-text);
  }

  .cthulhuUiConfirmationDialogCheckboxInput:focus-visible + .cthulhuUiConfirmationDialogCheckboxMark {
    outline: 2px solid var(--ui-danger-strong-border);
    outline-offset: 2px;
  }
</style>
