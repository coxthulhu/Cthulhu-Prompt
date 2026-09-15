<script lang="ts">
  import { AlertCircle } from 'lucide-svelte'
  import Dialog from '@renderer/common/cthulhu-ui/dialogs/Dialog.svelte'
  import LogDetails from '@renderer/common/cthulhu-ui/layout/LogDetails.svelte'
  import Title from '@renderer/common/cthulhu-ui/layout/Title.svelte'

  type Props = {
    open?: boolean
    title: string
    description: string
    errorText: string
  }

  let { open = $bindable(false), title, description, errorText }: Props = $props()
</script>

<Dialog
  bind:open
  class="w-full max-w-[576px]"
  icon={AlertCircle}
  {title}
  submitText=""
  cancelText="Close"
  showSubmitButton={false}
  closeOnOutsideClick
>
  <div class="flex min-w-0 flex-col gap-3 py-4">
    <section class="space-y-2">
      <Title title="Message" variant="small" />
      <p class="cthulhuUiErrorDialogMessage text-sm">{description}</p>
    </section>
    <LogDetails title="Details" text={errorText} />
  </div>
</Dialog>

<style>
  .cthulhuUiErrorDialogMessage {
    color: var(--ui-normal-text);
    margin: 0;
    padding-left: 8px;
  }
</style>
