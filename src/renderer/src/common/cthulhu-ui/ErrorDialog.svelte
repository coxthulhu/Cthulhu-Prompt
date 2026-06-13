<script lang="ts">
  import Dialog from './Dialog.svelte'
  import LogDetails from './LogDetails.svelte'
  import Title from './Title.svelte'

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
  {title}
  submitText=""
  cancelText="Close"
  showSubmitButton={false}
>
  <div class="flex min-w-0 flex-col gap-3 py-4">
    <section class="space-y-2">
      <Title title="Message" variant="small" />
      <p class="cthulhuUiErrorDialogMessage">{description}</p>
    </section>
    <LogDetails title="Details" text={errorText} />
  </div>
</Dialog>

<style>
  .cthulhuUiErrorDialogMessage {
    color: var(--ui-normal-text);
    font-size: 14px;
    line-height: 1.5;
    margin: 0;
    padding-left: 8px;
  }
</style>
