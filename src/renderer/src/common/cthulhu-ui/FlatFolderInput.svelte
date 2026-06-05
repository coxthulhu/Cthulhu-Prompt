<script lang="ts">
  import { FolderOpen } from 'lucide-svelte'
  import { ipcInvoke, runIpcBestEffort } from '@renderer/data/IpcFramework/IpcInvoke'
  import FlatButton from './FlatButton.svelte'

  type OpenFolderDialogResult = {
    dialogCancelled: boolean
    filePaths: string[]
  }

  type Props = {
    value?: string
    buttonText?: string
    buttonTestId?: string
    ariaLabel?: string
    class?: string
    disabled?: boolean
  }

  let {
    value = $bindable(''),
    buttonText = 'Browse',
    buttonTestId,
    ariaLabel,
    class: className,
    disabled = false,
  }: Props = $props()

  let isBrowsing = $state(false)

  const openFolderDialog = async (): Promise<OpenFolderDialogResult> => {
    isBrowsing = true
    try {
      return await ipcInvoke<OpenFolderDialogResult>('select-workspace-folder')
    } finally {
      isBrowsing = false
    }
  }

  const handleBrowse = async () => {
    const result = await runIpcBestEffort(openFolderDialog, () => ({
      dialogCancelled: true,
      filePaths: []
    }))

    if (!result.dialogCancelled && result.filePaths.length > 0) {
      value = result.filePaths[0]
    }
  }

  const buttonState = $derived(disabled || isBrowsing ? 'disabled' : 'enabled')
</script>

<FlatButton
  icon={FolderOpen}
  text={buttonText}
  state={buttonState}
  class={className}
  testId={buttonTestId}
  aria-label={ariaLabel}
  onclick={handleBrowse}
/>
