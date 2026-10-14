<script lang="ts">
  import { ExternalLink, FolderOpen } from 'lucide-svelte'
  import IconButton from '@renderer/common/cthulhu-ui/buttons/IconButton.svelte'
  import Row from '@renderer/common/cthulhu-ui/layout/Row.svelte'
  import { ipcInvoke, runIpcBestEffort } from '@renderer/data/IpcFramework/IpcInvoke'
  import { getWorkspaceFolderName } from './workspaceDisplay'

  /** Current workspace and distinct selectors for each summary surface. */
  let { workspacePath, pathTestId, openFolderTestId, compact = false } = $props<{
    workspacePath: string | null
    pathTestId: string
    openFolderTestId: string
    /** Shrinks popup text and glyphs while preserving the workspace row's alignment. */
    compact?: boolean
  }>()

  /** Folder-derived title shared by Home and the workspace popup. */
  const workspaceName = $derived(workspacePath ? getWorkspaceFolderName(workspacePath) : undefined)

  /** Hands the selected workspace folder to Windows Explorer through the preload bridge. */
  const openWorkspaceFolder = (): void => {
    /** Capture the current path for this invocation. */
    const targetWorkspacePath = workspacePath
    if (!targetWorkspacePath) return
    void runIpcBestEffort(() => ipcInvoke<void, string>('open-workspace-folder', targetWorkspacePath))
  }
</script>

<!-- Shared workspace details and Explorer action with surface-appropriate sizing. -->
<Row
  variant="workspace"
  icon={FolderOpen}
  iconClass={compact ? 'size-6' : undefined}
  label={workspaceName ?? 'No workspace open'}
  labelTitle={workspaceName}
  detail={workspacePath ?? 'Open a workspace or create one to get started.'}
  detailTitle={workspacePath ?? undefined}
  detailTestId={workspacePath ? pathTestId : undefined}
  class={compact ? 'p-4 [&_.cthulhuUiTitle]:text-lg [&_.cthulhuUiTitle]:leading-7' : 'p-4'}
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
