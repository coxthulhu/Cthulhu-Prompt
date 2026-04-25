<script lang="ts">
  import { FolderOpen } from 'lucide-svelte'
  import type { HTMLInputAttributes } from 'svelte/elements'
  import type { WithElementRef } from '@renderer/common/Cn.js'
  import { ipcInvoke, runIpcBestEffort } from '@renderer/data/IpcFramework/IpcInvoke'
  import IconTextButton from './IconTextButton.svelte'
  import TextInput from './TextInput.svelte'
  import { mergeClasses } from './mergeClasses'

  type OpenFolderDialogResult = {
    dialogCancelled: boolean
    filePaths: string[]
  }

  type Props = WithElementRef<
    Omit<HTMLInputAttributes, 'type' | 'value' | 'files'> & {
      value?: string
      buttonText?: string
      buttonTestId?: string
    }
  >

  let {
    ref = $bindable(null),
    value = $bindable(''),
    buttonText = 'Browse',
    buttonTestId,
    class: className,
    disabled = false,
    ...restProps
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

<div class={mergeClasses('flex min-w-0 items-center gap-3', className)}>
  <TextInput bind:ref bind:value class="flex-1" readonly {disabled} {...restProps} />
  <IconTextButton
    icon={FolderOpen}
    text={buttonText}
    state={buttonState}
    testId={buttonTestId}
    onclick={handleBrowse}
  />
</div>
