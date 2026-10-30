<script lang="ts">
  import type { ComponentType } from 'svelte'
  import { Eye, EyeOff, NotebookPen } from 'lucide-svelte'
  import NotebookX from './NotebookX.svelte'
  import SplitIconButton from '@renderer/common/cthulhu-ui/buttons/SplitIconButton.svelte'
  import ConfirmationDialog from '@renderer/common/cthulhu-ui/dialogs/ConfirmationDialog.svelte'
  import { deleteNote } from '@renderer/data/Mutations/NoteMutations'
  import { runIpcBestEffort } from '@renderer/data/IpcFramework/IpcInvoke'

  /** Shared note toolbar action for prompt and template editors. */
  let { noteId, noteText = '', visible, ontoggle }: {
    /** Existing attachment, absent until Add Note succeeds. */
    noteId?: string
    /** Optimistic note text that selects the blank-note delete action. */
    noteText?: string
    /** Current persisted visibility. */
    visible: boolean
    /** Adds or toggles the owning card's note, deleting a visible blank note instead of hiding it. */
    ontoggle: () => void
  } = $props()
  /** Confirmation dialog state for nonblank note deletion. */
  let confirmDelete = $state(false)
  /** Whether the note has text worth confirming before deletion. */
  const hasText = $derived(noteText.trim().length > 0)
  /** A visible blank note makes deletion the main action, matching the toggle's delete-on-hide. */
  const isDeleteDefaultAction = $derived(noteId !== undefined && visible && !hasText)
  /** Accessible label describes the main action. */
  const label = $derived(
    !noteId ? 'Add attached note' : isDeleteDefaultAction ? 'Delete attached note' : visible ? 'Hide attached note' : 'Show attached note'
  )
  /** Runes icon cast to the legacy class type that shared icon props still declare. */
  const deleteNoteIcon = NotebookX as unknown as ComponentType
  /** Main icon matching the current main action. */
  const mainIcon = $derived(!noteId ? NotebookPen : isDeleteDefaultAction ? deleteNoteIcon : visible ? Eye : EyeOff)
  /** The dropdown offers only deletion; its trigger is disabled when the main action already deletes or no note exists. */
  const moreOptions = [{ id: 'delete', label: 'Delete Note', detail: 'Permanently delete attached note', icon: deleteNoteIcon, testId: 'attached-note-delete' }]

  /** Removes the note and its persisted visibility through the existing atomic mutation. */
  const handleDelete = (): void => {
    confirmDelete = false
    void runIpcBestEffort(() => deleteNote(noteId!))
  }

  /** Deletes blank notes immediately and confirms deletion for nonblank notes. */
  const handleDeleteSelect = (): void => {
    if (hasText) {
      confirmDelete = true
      return
    }

    handleDelete()
  }
</script>

<!-- The main action stays available when the options trigger is disabled. -->
<SplitIconButton
  icon={mainIcon}
  {label}
  title={label}
  ariaPressed={noteId && !isDeleteDefaultAction ? visible : undefined}
  {moreOptions}
  moreOptionsDisabled={!noteId || isDeleteDefaultAction}
  mainHoverVariant={isDeleteDefaultAction ? 'danger' : 'neutral'}
  testId="attached-note-button"
  moreOptionsTestId="attached-note-options"
  menuTestId="attached-note-menu"
  onclick={ontoggle}
  onselect={handleDeleteSelect}
/>

<ConfirmationDialog
  bind:open={confirmDelete}
  title="Delete Attached Note"
  description="Are you sure you want to permanently delete this attached note?"
  confirmText="Delete"
  confirmTestId="attached-note-confirm-delete"
  oncancel={() => { confirmDelete = false }}
  onconfirm={handleDelete}
/>
