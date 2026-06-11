<script lang="ts">
  import FlatDialog from './FlatDialog.svelte'
  import FlatTitle from './FlatTitle.svelte'
  import LogDetails from './LogDetails.svelte'

  type Props = {
    open?: boolean
    title: string
    description: string
    errorText: string
  }

  let { open = $bindable(false), title, description, errorText }: Props = $props()
</script>

<FlatDialog
  bind:open
  class="w-full max-w-[576px]"
  {title}
  submitText=""
  cancelText="Close"
  showSubmitButton={false}
>
  <div class="flex min-w-0 flex-col gap-3 py-4">
    <section class="space-y-2">
      <FlatTitle title="Message" size="small" headingLevel={3} />
      <p class="cthulhuUiFlatErrorDialogMessage">{description}</p>
    </section>
    <LogDetails title="Details" text={errorText} />
  </div>
</FlatDialog>

<style>
  .cthulhuUiFlatErrorDialogMessage {
    color: var(--ui-flat-normal-text);
    font-size: 14px;
    line-height: 1.5;
    margin: 0;
    padding-left: 8px;
  }
</style>
