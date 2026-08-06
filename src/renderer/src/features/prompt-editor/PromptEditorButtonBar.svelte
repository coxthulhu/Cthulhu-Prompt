<script lang="ts">
  import ConfirmationDialog from '@renderer/common/cthulhu-ui/ConfirmationDialog.svelte'
  import CopyButton from '@renderer/common/cthulhu-ui/CopyButton.svelte'
  import IconButtonBar from '@renderer/common/cthulhu-ui/IconButtonBar.svelte'
  import IconButton from '@renderer/common/cthulhu-ui/IconButton.svelte'
  import { Layers, Trash2, Zap } from 'lucide-svelte'

  type Props = {
    title: string
    draftText: string
    copyText?: string
    onDelete?: () => void
    onTemplateSelect?: () => void
    onTemplateSelectAndCopy?: () => void
    // The prompt's template decision controls whether Copy or quick selection is available.
    templateSelectionState?: 'not-selected' | 'no-template' | 'selected'
    copyLabel?: string
    copyTitle?: string
    deleteLabel?: string
    deleteDialogTitle?: string
    deleteDialogDescription?: string
    onCopySuccess?: () => void | Promise<void>
  }

  let {
    title,
    draftText,
    copyText,
    onDelete,
    onTemplateSelect,
    onTemplateSelectAndCopy,
    // Template editors omit quick selection and retain Copy with this default state.
    templateSelectionState = 'not-selected',
    copyLabel = 'Copy prompt',
    copyTitle = 'Copy prompt',
    deleteLabel = 'Delete prompt',
    deleteDialogTitle = 'Delete Prompt',
    deleteDialogDescription = 'Are you sure you want to delete this prompt?',
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

<IconButtonBar>
  {#if onDelete}
    <IconButton
      icon={Trash2}
      label={deleteLabel}
      title={deleteLabel}
      hoverVariant="danger"
      testId="prompt-delete-button"
      onclick={handleDeleteClick}
    />
  {/if}
  {#if onTemplateSelect}
    <IconButton
      icon={Layers}
      label="Set Template"
      title="Set Template"
      testId="prompt-template-button"
      onclick={onTemplateSelect}
    />
  {/if}
  {#if !onTemplateSelectAndCopy || templateSelectionState !== 'not-selected'}
    <CopyButton
      text={copyText ?? draftText}
      label={copyLabel}
      title={copyTitle}
      hoverVariant="accent"
      testId="prompt-copy-button"
      onCopied={onCopySuccess}
    />
  {/if}
  {#if onTemplateSelectAndCopy && templateSelectionState === 'not-selected'}
    <IconButton
      icon={Zap}
      label="Select Template and Copy"
      title="Select Template and Copy"
      testId="prompt-template-and-copy-button"
      onclick={onTemplateSelectAndCopy}
    />
  {/if}
</IconButtonBar>

{#if onDelete}
  <ConfirmationDialog
    bind:open={isDeleteDialogOpen}
    title={deleteDialogTitle}
    description={deleteDialogDescription}
    confirmText="Delete"
    confirmTestId="prompt-confirm-delete-button"
    oncancel={handleCancelDelete}
    onconfirm={handleConfirmDelete}
  />
{/if}
