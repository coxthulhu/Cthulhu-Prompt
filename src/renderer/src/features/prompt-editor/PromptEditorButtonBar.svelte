<script lang="ts">
  import ConfirmationDialog from '@renderer/common/cthulhu-ui/ConfirmationDialog.svelte'
  import CopyButton from '@renderer/common/cthulhu-ui/CopyButton.svelte'
  import IconButton from '@renderer/common/cthulhu-ui/IconButton.svelte'
  import Separator from '@renderer/common/cthulhu-ui/Separator.svelte'
  import { Check, Trash2, Undo2 } from 'lucide-svelte'

  type Props = {
    title: string
    draftText: string
    copyText?: string
    onDelete?: () => void
    onComplete?: () => void
    onUncomplete?: () => void
    copyLabel?: string
    copyTitle?: string
  }

  let {
    title,
    draftText,
    copyText,
    onDelete,
    onComplete,
    onUncomplete,
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
  {#if onComplete}
    <IconButton
      icon={Check}
      label="Complete prompt"
      title="Complete prompt"
      hoverVariant="success"
      testId="prompt-complete-button"
      onclick={onComplete}
    />
  {/if}
  {#if onUncomplete}
    <IconButton
      icon={Undo2}
      label="Uncomplete prompt"
      title="Uncomplete prompt"
      hoverVariant="accent"
      testId="prompt-uncomplete-button"
      onclick={onUncomplete}
    />
  {/if}
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
  {#if onComplete || onUncomplete || onDelete}
    <Separator
      orientation="vertical"
      class="h-6"
      style="--cthulhu-ui-separator-color: var(--ui-neutral-normal-border);"
    />
  {/if}
  <CopyButton
    text={copyText ?? draftText}
    label={copyLabel}
    title={copyTitle}
    hoverVariant="accent"
    testId="prompt-copy-button"
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
