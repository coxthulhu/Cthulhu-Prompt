<script lang="ts">
  import ConfirmationDialog from '@renderer/common/cthulhu-ui/ConfirmationDialog.svelte'
  import IconOnlyButton from '@renderer/common/cthulhu-ui/IconOnlyButton.svelte'
  import { Check, Copy, Trash2 } from 'lucide-svelte'

  type Props = {
    title: string
    draftText: string
    onDelete?: () => void
    copyLabel?: string
    copyTitle?: string
  }

  let {
    title,
    draftText,
    onDelete,
    copyLabel = 'Copy prompt',
    copyTitle = 'Copy prompt'
  }: Props = $props()
  let isCopied = $state(false)
  let resetTimeoutId: number | null = null
  let isDeleteDialogOpen = $state(false)

  const handleCopyClick = () => {
    void window.navigator.clipboard.writeText(draftText)
    isCopied = true

    if (resetTimeoutId != null) {
      window.clearTimeout(resetTimeoutId)
    }

    // Keep "Copied" visible for 1.5 seconds after each click.
    resetTimeoutId = window.setTimeout(() => {
      isCopied = false
      resetTimeoutId = null
    }, 1500)
  }

  const handleDeleteClick = () => {
    if (!onDelete) return
    const hasContent = title.trim().length > 0 || draftText.trim().length > 0
    if (hasContent) {
      isDeleteDialogOpen = true
      return
    }

    onDelete()
  }

  const handleConfirmDelete = () => {
    if (!onDelete) return
    isDeleteDialogOpen = false
    onDelete()
  }

  const handleCancelDelete = () => {
    isDeleteDialogOpen = false
  }
</script>

<div class="flex shrink-0 items-center gap-1.5">
  <IconOnlyButton
    icon={isCopied ? Check : Copy}
    label={copyLabel}
    title={isCopied ? 'Copied' : copyTitle}
    variant="accent"
    testId="prompt-copy-button"
    onclick={handleCopyClick}
  />
  {#if onDelete}
    <IconOnlyButton
      icon={Trash2}
      label="Delete prompt"
      title="Delete prompt"
      variant="danger"
      testId="prompt-delete-button"
      onclick={handleDeleteClick}
    />
  {/if}
</div>

{#if onDelete}
  <ConfirmationDialog
    bind:open={isDeleteDialogOpen}
    title="Delete Prompt"
    description="Are you sure you want to delete this prompt?"
    confirmText="Delete"
    confirmTestId="prompt-confirm-delete-button"
    oncancel={handleCancelDelete}
    onconfirm={handleConfirmDelete}
  />
{/if}
