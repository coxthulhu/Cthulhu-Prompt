<script lang="ts">
  import { Trash2, X } from 'lucide-svelte'
  import type { ComponentType } from 'svelte'
  import FlatDialog from './FlatDialog.svelte'

  type Props = {
    open?: boolean
    title: string
    description: string
    confirmText: string
    icon?: ComponentType
    confirmTestId?: string
    oncancel?: () => void
    onconfirm?: () => void
  }

  let {
    open = $bindable(false),
    title,
    description,
    confirmText,
    icon = Trash2,
    confirmTestId,
    oncancel,
    onconfirm
  }: Props = $props()
</script>

<FlatDialog
  bind:open
  class="w-full max-w-[480px]"
  showCloseButton={false}
  {title}
  submitText={confirmText}
  submitIcon={icon}
  cancelIcon={X}
  submitVariant="danger"
  submitTestId={confirmTestId}
  {oncancel}
  onsubmit={onconfirm}
>
  <div class="flex min-w-0 flex-col py-4">
    <p class="cthulhuUiFlatConfirmationDialogMessage">{description}</p>
  </div>
</FlatDialog>

<style>
  .cthulhuUiFlatConfirmationDialogMessage {
    color: var(--ui-flat-normal-text);
    font-size: 14px;
    line-height: 1.5;
    margin: 0;
    padding-left: 8px;
  }
</style>
