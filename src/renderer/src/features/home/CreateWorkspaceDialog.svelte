<script lang="ts">
  import CheckboxInput from '@renderer/common/cthulhu-ui/CheckboxInput.svelte'
  import CthulhuDialog from '@renderer/common/cthulhu-ui/CthulhuDialog.svelte'
  import FileInput from '@renderer/common/cthulhu-ui/FileInput.svelte'
  import TextInput from '@renderer/common/cthulhu-ui/TextInput.svelte'
  import TitleBlock from '@renderer/common/cthulhu-ui/TitleBlock.svelte'
  import { FolderPlus } from 'lucide-svelte'

  let { open = $bindable(false) } = $props<{
    open?: boolean
  }>()

  let workspaceName = $state('')
  let workspacePath = $state('')
  let includeExamples = $state(true)

  const resetDialog = () => {
    open = false
    workspaceName = ''
    workspacePath = ''
    includeExamples = true
  }
</script>

<CthulhuDialog
  bind:open
  class="w-full max-w-[44rem]"
  icon={FolderPlus}
  title="Create Workspace"
  description="Choose the details for your new workspace."
  submitText="Create Workspace"
  submitTestId="create-workspace-submit-button"
  submitVariant="accent"
  oncancel={resetDialog}
  onsubmit={resetDialog}
>
  <div class="space-y-2">
    <TitleBlock title="Workspace Name" variant="small" />
    <TextInput
      id="create-workspace-name-input"
      class="w-full"
      bind:value={workspaceName}
      aria-label="Workspace Name"
      placeholder="Enter workspace name..."
      data-testid="create-workspace-name-input"
    />
  </div>

  <div class="space-y-2">
    <TitleBlock title="Workspace Path" variant="small" />
    <FileInput
      bind:value={workspacePath}
      aria-label="Workspace Path"
      placeholder="Choose a workspace folder"
      buttonTestId="create-workspace-path-browse-button"
      data-testid="create-workspace-path-input"
    />
  </div>

  <div class="space-y-2">
    <TitleBlock title="Add Examples" variant="small" />
    <CheckboxInput
      bind:checked={includeExamples}
      label='Include example prompts in a "My Prompts" folder.'
      data-testid="create-workspace-examples-checkbox-input"
      inputTestId="create-workspace-examples-checkbox"
    />
  </div>
</CthulhuDialog>
