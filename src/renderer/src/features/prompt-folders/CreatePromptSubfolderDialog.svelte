<script lang="ts">
  import { runIpcBestEffort } from '@renderer/data/IpcFramework/IpcInvoke'
  import { createPromptFolder } from '@renderer/data/Mutations/PromptFolderMutations'
  import type { PromptFolder } from '@shared/PromptFolder'
  import PromptFolderNameDialog from './PromptFolderNameDialog.svelte'
  import type { PromptFolderDividerTarget } from './promptFolderScreenRows'

  let {
    workspaceId,
    isWorkspaceReady,
    promptFolders = [],
    isPromptFolderListLoading,
    onCreated
  } = $props<{
    workspaceId: string | null
    isWorkspaceReady: boolean
    promptFolders: PromptFolder[]
    isPromptFolderListLoading: boolean
    onCreated?: (promptFolderId: string) => void
  }>()

  let target = $state<PromptFolderDividerTarget | null>(null)
  let promptFolderNameDialog = $state<{ openDialog: () => void } | null>(null)
  const siblingPromptFolders = $derived.by(() => {
    if (!target) return []
    const owner = promptFolders.find((folder) => folder.id === target?.ownerFolderId)
    if (!owner) return []
    const childIds = new Set(
      owner.entries.filter((entry) => entry.kind === 'folder').map((entry) => entry.id)
    )
    return promptFolders.filter((folder) => childIds.has(folder.id))
  })

  export const openDialog = (nextTarget: PromptFolderDividerTarget) => {
    if (!isWorkspaceReady || !workspaceId) return

    target = nextTarget
    promptFolderNameDialog?.openDialog()
  }

  const handleCreateSubfolder = async (normalizedDisplayName: string): Promise<boolean> => {
    const selectedTarget = target
    if (!workspaceId || !selectedTarget) return false

    return await runIpcBestEffort(
      async () => {
        const createdPromptFolderId = await createPromptFolder(
          workspaceId,
          normalizedDisplayName,
          selectedTarget.ownerFolderId,
          selectedTarget.previousEntryId
        )
        onCreated?.(createdPromptFolderId)
        return true
      },
      () => false
    )
  }
</script>

<PromptFolderNameDialog
  bind:this={promptFolderNameDialog}
  {isWorkspaceReady}
  promptFolders={siblingPromptFolders}
  {isPromptFolderListLoading}
  title="Create Prompt Subfolder"
  submitText="Create Subfolder"
  submittingText="Creating..."
  submitTestId="create-prompt-subfolder-button"
  inputTestId="create-prompt-subfolder-name-input"
  errorTestId="create-prompt-subfolder-name-error"
  rowDetail="Name the new prompt subfolder."
  failureMessage="Failed to create subfolder. Please try again."
  onsubmit={handleCreateSubfolder}
/>
