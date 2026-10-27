<script lang="ts">
  import { Eye, EyeOff, NotebookPen, Trash2 } from 'lucide-svelte'
  import SplitIconButton from '@renderer/common/cthulhu-ui/buttons/SplitIconButton.svelte'
  import ConfirmationDialog from '@renderer/common/cthulhu-ui/dialogs/ConfirmationDialog.svelte'
  import { deleteNote } from '@renderer/data/Mutations/NoteMutations'
  import { runIpcBestEffort } from '@renderer/data/IpcFramework/IpcInvoke'

  /** Shared note toolbar action for prompt and template editors. */
  let { noteId, visible, ontoggle }: {
    /** Existing attachment, absent until Add Note succeeds. */
    noteId?: string
    /** Current persisted visibility. */
    visible: boolean
    /** Adds or toggles the owning card's note. */
    ontoggle: () => void
  } = $props()
  /** Every deletion, including an empty note, requires confirmation. */
  let confirmDelete = $state(false)
  /** Accessible label describes the main action. */
  const label = $derived(!noteId ? 'Add attached note' : visible ? 'Hide attached note' : 'Show attached note')
  /** The dropdown offers only deletion; its trigger is disabled without a note. */
  const moreOptions = [{ id: 'delete', label: 'Delete Note', detail: 'Permanently delete attached note', icon: Trash2, testId: 'attached-note-delete' }]

  /** Removes the note and its persisted visibility through the existing atomic mutation. */
  const handleDelete = (): void => {
    confirmDelete = false
    void runIpcBestEffort(() => deleteNote(noteId!))
  }
</script>

<!-- The main action stays available when the options trigger is disabled. -->
<SplitIconButton
  icon={!noteId ? NotebookPen : visible ? Eye : EyeOff}
  {label}
  title={label}
  ariaPressed={noteId ? visible : undefined}
  {moreOptions}
  moreOptionsDisabled={!noteId}
  testId="attached-note-button"
  moreOptionsTestId="attached-note-options"
  menuTestId="attached-note-menu"
  onclick={ontoggle}
  onselect={() => { confirmDelete = true }}
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
