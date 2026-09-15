<script lang="ts">
  import { FolderOpen } from 'lucide-svelte'
  import { mergeClasses } from '@renderer/common/cthulhu-ui/mergeClasses'
  import { ipcInvoke, runIpcBestEffort } from '@renderer/data/IpcFramework/IpcInvoke'
  import Button from '@renderer/common/cthulhu-ui/buttons/Button.svelte'
  import TextInput from '@renderer/common/cthulhu-ui/forms/TextInput.svelte'

  /** Native folder-picker response returned through the preload bridge. */
  type OpenFolderDialogResult = {
    dialogCancelled: boolean
    filePaths: string[]
  }

  /** Display and browse-button options for the compound folder field. */
  type Props = {
    value?: string
    buttonText?: string
    buttonTestId?: string
    ariaLabel?: string
    inputId?: string
    inputTestId?: string
    inputAriaLabel?: string
    inputAriaDescribedby?: string
    class?: string
    disabled?: boolean
  }

  /** Bound folder path and presentation options supplied by the containing form. */
  let {
    value = $bindable(''),
    buttonText = 'Browse',
    buttonTestId,
    ariaLabel,
    inputId,
    inputTestId,
    inputAriaLabel = 'Selected folder',
    inputAriaDescribedby,
    class: className,
    disabled = false
  }: Props = $props()

  /** Whether the native folder picker is currently open. */
  let isBrowsing = $state(false)

  /** Opens the native folder picker while tracking its pending state. */
  const openFolderDialog = async (): Promise<OpenFolderDialogResult> => {
    isBrowsing = true
    try {
      return await ipcInvoke<OpenFolderDialogResult>('select-workspace-folder')
    } finally {
      isBrowsing = false
    }
  }

  /** Copies a successful folder selection into the bound path value. */
  const handleBrowse = async () => {
    const result = await runIpcBestEffort(openFolderDialog, () => ({
      dialogCancelled: true,
      filePaths: []
    }))

    if (!result.dialogCancelled && result.filePaths.length > 0) {
      value = result.filePaths[0]
    }
  }

  /** Effective browse-button state while the field is disabled or browsing. */
  const buttonState = $derived(disabled || isBrowsing ? 'disabled' : 'enabled')
</script>

<!-- Disabled path display paired with the native folder-picker action. -->
<div class={mergeClasses('cthulhuUiFolderInput flex min-w-0 gap-2', className)}>
  <TextInput
    id={inputId}
    class="min-w-0 flex-1"
    {value}
    aria-label={inputAriaLabel}
    aria-describedby={inputAriaDescribedby}
    data-testid={inputTestId}
    placeholder="Select a folder..."
    disabled
  />
  <Button
    icon={FolderOpen}
    text={buttonText}
    state={buttonState}
    class="shrink-0"
    testId={buttonTestId}
    aria-label={ariaLabel}
    onclick={handleBrowse}
  />
</div>
