<script lang="ts">
  import { AlertCircle } from 'lucide-svelte'
  import CthulhuDialog from './CthulhuDialog.svelte'
  import LogDetails from './LogDetails.svelte'

  type Props = {
    open?: boolean
    title: string
    description: string
    errorText: string
  }

  let { open = $bindable(false), title, description, errorText }: Props = $props()
</script>

<CthulhuDialog
  bind:open
  class="w-full max-w-[36rem]"
  icon={AlertCircle}
  iconVariant="danger"
  title={title}
  description={description}
  submitText=""
  showSubmitButton={false}
>
  <LogDetails title="Details" text={errorText} />
</CthulhuDialog>
