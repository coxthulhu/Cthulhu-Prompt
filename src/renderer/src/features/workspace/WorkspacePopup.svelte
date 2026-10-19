<script lang="ts">
  import { ExternalLink, FolderOpen, X } from 'lucide-svelte'
  import Button from '@renderer/common/cthulhu-ui/buttons/Button.svelte'
  import IconButton from '@renderer/common/cthulhu-ui/buttons/IconButton.svelte'
  import Popup from '@renderer/common/cthulhu-ui/dialogs/Popup.svelte'
  import Separator from '@renderer/common/cthulhu-ui/layout/Separator.svelte'
  import Title from '@renderer/common/cthulhu-ui/layout/Title.svelte'
  import TitleSubtitleStack from '@renderer/common/cthulhu-ui/layout/TitleSubtitleStack.svelte'
  import { ipcInvoke, runIpcBestEffort } from '@renderer/data/IpcFramework/IpcInvoke'
  import { getWorkspaceFolderName } from './workspaceDisplay'

  /** Activity-owned visibility and anchor keep workspace information beside its button. */
  let { open = $bindable(false), anchor, workspacePath } = $props<{
    open?: boolean
    anchor?: HTMLElement
    workspacePath: string | null
  }>()

  /** Keep the displayed name in sync when the workspace changes behind the popup. */
  const workspaceName = $derived(workspacePath ? getWorkspaceFolderName(workspacePath) : 'No workspace open')

  /** Open the current workspace in Windows Explorer through the preload bridge. */
  const openWorkspaceFolder = (): void => {
    const targetWorkspacePath = workspacePath
    if (!targetWorkspacePath) return
    void runIpcBestEffort(() => ipcInvoke<void, string>('open-workspace-folder', targetWorkspacePath))
  }
</script>

<!-- Nonmodal workspace details remain available without changing the active screen. -->
<Popup bind:open title="Workspace Info" backdrop={false} placement="top-left" {anchor}
  offsetX={58} offsetY={0} class="flex w-[360px] flex-col text-sm leading-5" testId="workspace-popup">
  {#snippet children(closeWorkspace)}
    <header class="flex min-w-0 items-center gap-2 px-4 py-3">
      <FolderOpen size={24} class="shrink-0" aria-hidden="true" />
      <h2 class="m-0 flex-1 text-lg font-semibold">Workspace Info</h2>
      <IconButton icon={X} label="Close workspace details" onclick={closeWorkspace} />
    </header>
    <Separator />
    <div class="min-w-0 p-4">
      <div class="grid gap-[17px] pb-[18px]">
        <TitleSubtitleStack>
          <Title title="Workspace Name" variant="small" />
          <p class="m-0 text-sm leading-5 text-[var(--ui-normal-text)] [overflow-wrap:anywhere]"
            data-testid="workspace-popup-name">{workspaceName}</p>
        </TitleSubtitleStack>
        <TitleSubtitleStack>
          <Title title="Location" variant="small" />
          <p class="m-0 text-sm leading-5 text-[var(--ui-normal-text)] select-text [overflow-wrap:anywhere]"
            title={workspacePath ?? undefined} data-testid={workspacePath ? 'workspace-popup-path' : undefined}>
            {workspacePath ?? 'Open a workspace or create one to get started.'}
          </p>
        </TitleSubtitleStack>
      </div>
      <Separator />
      <div class="pt-[14px]">
        <Button variant="accent" disabled={!workspacePath} icon={ExternalLink}
          text="Open in Explorer" testId="workspace-popup-open-folder-button" onclick={openWorkspaceFolder}
          style="width:100%;max-width:none;justify-content:center;" />
      </div>
    </div>
  {/snippet}
</Popup>
