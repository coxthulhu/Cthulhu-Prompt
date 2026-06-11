<script lang="ts">
  import FlatDialog from './FlatDialog.svelte'

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

<FlatDialog
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
  <div class="cthulhuUiFlatConfirmationDialogContent">
    <p class="cthulhuUiFlatConfirmationDialogMessage">{description}</p>
  </div>
</FlatDialog>

<style>
  .cthulhuUiFlatConfirmationDialogContent {
    min-width: 0;
    padding: 4px;
  }

  .cthulhuUiFlatConfirmationDialogMessage {
    color: var(--ui-flat-normal-text);
    font-size: 16px;
    line-height: 1.5;
    margin: 0;
    min-width: 0;
  }
</style>
