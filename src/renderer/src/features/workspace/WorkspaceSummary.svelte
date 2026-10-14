<script lang="ts">
  import { ExternalLink, FolderOpen } from 'lucide-svelte'
  import IconButton from '@renderer/common/cthulhu-ui/buttons/IconButton.svelte'
  import Row from '@renderer/common/cthulhu-ui/layout/Row.svelte'
  import { ipcInvoke, runIpcBestEffort } from '@renderer/data/IpcFramework/IpcInvoke'
  import { getWorkspaceFolderName } from './workspaceDisplay'

  /** Current workspace and distinct selectors for each summary surface. */
  let { workspacePath, pathTestId, openFolderTestId } = $props<{
    workspacePath: string | null
    pathTestId: string
    openFolderTestId: string
  }>()

  /** Folder-derived title for the Home summary. */
  const workspaceName = $derived(workspacePath ? getWorkspaceFolderName(workspacePath) : undefined)

  /** Hands the selected workspace folder to Windows Explorer through the preload bridge. */
  const openWorkspaceFolder = (): void => {
    /** Capture the current path for this invocation. */
    const targetWorkspacePath = workspacePath
    if (!targetWorkspacePath) return
    void runIpcBestEffort(() => ipcInvoke<void, string>('open-workspace-folder', targetWorkspacePath))
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
