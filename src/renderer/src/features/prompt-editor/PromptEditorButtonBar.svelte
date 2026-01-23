<script lang="ts">
  import Button from '@renderer/common/ui/button/button.svelte'
  import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle
  } from '@renderer/common/ui/dialog'

  type Props = {
    title: string
    draftText: string
    onDelete: () => void
  }

  let { title, draftText, onDelete }: Props = $props()
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
    const hasContent = title.trim().length > 0 || draftText.trim().length > 0
    if (hasContent) {
      isDeleteDialogOpen = true
      return
    }

    onDelete()
  }

  const handleConfirmDelete = () => {
    isDeleteDialogOpen = false
    onDelete()
  }

  const handleCancelDelete = () => {
    isDeleteDialogOpen = false
  }
</script>

<div class="flex gap-1 shrink-0">
  <Button variant="outline" size="xs" class="text-[rgb(248,128,112)]" onclick={handleDeleteClick}>
    Delete
  </Button>
  <Button variant="outline" size="xs" onclick={handleCopyClick} data-testid="prompt-copy-button">
    <span class="relative inline-flex items-center">
      <span
        class={`absolute inset-0 transition-opacity duration-[140ms] ${isCopied ? 'opacity-0 delay-0' : 'opacity-100 delay-[140ms]'}`}
      >
        Copy
      </span>
      <span
        class={`transition-opacity duration-[140ms] ${isCopied ? 'opacity-100 delay-[140ms]' : 'opacity-0 delay-0'}`}
      >
        Copied
      </span>
    </span>
  </Button>
</div>

<Dialog bind:open={isDeleteDialogOpen}>
  <DialogContent showCloseButton={false}>
    <DialogHeader>
      <DialogTitle>Delete Prompt</DialogTitle>
      <DialogDescription>Are you sure you want to delete this prompt?</DialogDescription>
    </DialogHeader>
    <DialogFooter>
      <Button variant="outline" onclick={handleCancelDelete}>Cancel</Button>
      <Button variant="destructive" onclick={handleConfirmDelete}>Delete</Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
