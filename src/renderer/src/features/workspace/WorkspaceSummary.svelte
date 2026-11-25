<script lang="ts">
  import { ExternalLink, FolderOpen } from '@lucide/svelte'
  import IconButton from '@renderer/common/cthulhu-ui/buttons/IconButton.svelte'
  import Row from '@renderer/common/cthulhu-ui/layout/Row.svelte'
  import { ipcInvoke, runIpcBestEffort } from '@renderer/data/IpcFramework/IpcInvoke'

  /** Current workspace and distinct selectors for each summary surface. */
  let { workspaceName, workspacePath, pathTestId, openFolderTestId } = $props<{
    workspaceName?: string
    workspacePath: string | null
    pathTestId: string
    openFolderTestId: string
  }>()

  /** Reveals the selected workspace database in Windows Explorer. */
  const openWorkspaceFolder = (): void => {
    void runIpcBestEffort(() => ipcInvoke<void>('open-workspace-folder'))
  }
</script>

<!-- Workspace details and Explorer action for the Home screen. -->
<Row
  variant="workspace"
  icon={FolderOpen}
  label={workspaceName ?? 'No workspace open'}
  labelTitle={workspaceName}
  detail={workspacePath ?? 'Open a workspace or create one to get started.'}
  detailTitle={workspacePath ?? undefined}
  detailTestId={workspacePath ? pathTestId : undefined}
  class="p-4"
>
  {#snippet trailing()}
    <IconButton
      icon={ExternalLink}
      label="Open Workspace Folder"
      title="Open Workspace Folder"
      testId={openFolderTestId}
      disabled={!workspacePath}
      onclick={openWorkspaceFolder}
    />
  {/snippet}
</Row>
