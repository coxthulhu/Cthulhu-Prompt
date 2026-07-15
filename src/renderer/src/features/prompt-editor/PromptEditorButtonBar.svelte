<script lang="ts">
  import ConfirmationDialog from '@renderer/common/cthulhu-ui/ConfirmationDialog.svelte'
  import CopyButton from '@renderer/common/cthulhu-ui/CopyButton.svelte'
  import IconButton from '@renderer/common/cthulhu-ui/IconButton.svelte'
  import { Trash2 } from 'lucide-svelte'

  type Props = {
    title: string
    draftText: string
    copyText?: string
    onDelete?: () => void
    copyLabel?: string
    copyTitle?: string
    onCopySuccess?: () => void | Promise<void>
  }

  let {
    title,
    draftText,
    copyText,
    onDelete,
    copyLabel = 'Copy prompt',
    copyTitle = 'Copy prompt',
    onCopySuccess
  }: Props = $props()
  let isDeleteDialogOpen = $state(false)

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
  {#if onDelete}
    <IconButton
      icon={Trash2}
      label="Delete prompt"
      title="Delete prompt"
      hoverVariant="danger"
      testId="prompt-delete-button"
      onclick={handleDeleteClick}
    />
  {/if}
  <CopyButton
    text={copyText ?? draftText}
    label={copyLabel}
    title={copyTitle}
    hoverVariant="accent"
    testId="prompt-copy-button"
    onCopied={onCopySuccess}
  />
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
