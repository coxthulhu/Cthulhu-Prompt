<script lang="ts">
  import Dialog from './Dialog.svelte'

  type Props = {
    open?: boolean
    title: string
    description: string
    confirmText: string
    confirmTestId?: string
    oncancel?: () => void
    onconfirm?: () => void
  }

  let {
    open = $bindable(false),
    title,
    description,
    confirmText,
    confirmTestId,
    oncancel,
    onconfirm
  }: Props = $props()
</script>

<Dialog
  bind:open
  class="w-full max-w-[480px]"
  {title}
  submitText={confirmText}
  showSeparators={false}
  submitVariant="danger"
  submitTestId={confirmTestId}
  {oncancel}
  onsubmit={onconfirm}
>
  <div class="cthulhuUiConfirmationDialogContent">
    <p class="cthulhuUiConfirmationDialogMessage">{description}</p>
  </div>
</Dialog>

<style>
  .cthulhuUiConfirmationDialogContent {
    min-width: 0;
    padding: 4px;
  }

  .cthulhuUiConfirmationDialogMessage {
    color: var(--ui-normal-text);
    font-size: 16px;
    line-height: 1.5;
    margin: 0;
    min-width: 0;
  }
</style>
