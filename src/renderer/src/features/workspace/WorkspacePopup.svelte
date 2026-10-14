<script lang="ts">
  import { FolderOpen, X } from 'lucide-svelte'
  import IconButton from '@renderer/common/cthulhu-ui/buttons/IconButton.svelte'
  import Popup from '@renderer/common/cthulhu-ui/dialogs/Popup.svelte'
  import Separator from '@renderer/common/cthulhu-ui/layout/Separator.svelte'
  import WorkspaceSummary from './WorkspaceSummary.svelte'

  /** Activity-owned visibility and anchor keep workspace information beside its button. */
  let { open = $bindable(false), anchor, workspacePath } = $props<{
    open?: boolean
    anchor?: HTMLElement
    workspacePath: string | null
  }>()
</script>

<!-- Nonmodal workspace details remain available without changing the active screen. -->
<Popup bind:open title="Workspace" backdrop={false} placement="top-left" {anchor}
  offsetX={58} offsetY={0} class="flex w-[400px] flex-col text-sm leading-5" testId="workspace-popup">
  {#snippet children(closeWorkspace)}
    <header class="flex min-w-0 items-center gap-2 px-4 py-3">
      <FolderOpen size={24} class="shrink-0" aria-hidden="true" />
      <h2 class="m-0 flex-1 text-lg font-semibold">Workspace</h2>
      <IconButton icon={X} label="Close workspace details" onclick={closeWorkspace} />
    </header>
    <Separator />
    <WorkspaceSummary compact {workspacePath} pathTestId="workspace-popup-path"
      openFolderTestId="workspace-popup-open-folder-button" />
  {/snippet}
</Popup>
