<script lang="ts">
  import FlatConfirmationDialog from '@renderer/common/cthulhu-ui/FlatConfirmationDialog.svelte'
  import FlatCopyButton from '@renderer/common/cthulhu-ui/FlatCopyButton.svelte'
  import FlatIconButton from '@renderer/common/cthulhu-ui/FlatIconButton.svelte'
  import FlatSeparator from '@renderer/common/cthulhu-ui/FlatSeparator.svelte'
  import { Trash2 } from 'lucide-svelte'

  type Props = {
    title: string
    draftText: string
    copyText?: string
    onDelete?: () => void
    copyLabel?: string
    copyTitle?: string
  }

  let {
    title,
    draftText,
    copyText,
    onDelete,
    copyLabel = 'Copy prompt',
    copyTitle = 'Copy prompt'
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
  <FlatCopyButton
    text={copyText ?? draftText}
    label={copyLabel}
    title={copyTitle}
    testId="prompt-copy-button"
  />
  {#if onDelete}
    <FlatSeparator orientation="vertical" class="h-6" />
    <FlatIconButton
      icon={Trash2}
      label="Delete prompt"
      title="Delete prompt"
      hoverVariant="danger"
      testId="prompt-delete-button"
      onclick={handleDeleteClick}
    />
  {/if}
</div>

{#if onDelete}
  <FlatConfirmationDialog
    bind:open={isDeleteDialogOpen}
    title="Delete Prompt"
    description="Are you sure you want to delete this prompt?"
    confirmText="Delete"
    confirmTestId="prompt-confirm-delete-button"
    oncancel={handleCancelDelete}
    onconfirm={handleConfirmDelete}
  />
{/if}
