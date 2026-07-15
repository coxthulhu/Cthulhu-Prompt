<script lang="ts">
  import { getWorkspaceSelectionContext } from '@renderer/app/WorkspaceSelectionContext'
  import { promptFolderCollection } from '@renderer/data/Collections/PromptFolderCollection'
  import { workspaceCollection } from '@renderer/data/Collections/WorkspaceCollection'
  import { createPromptFolder } from '@renderer/data/Mutations/PromptFolderMutations'
  import { runIpcBestEffort } from '@renderer/data/IpcFramework/IpcInvoke'
  import type { PromptFolder } from '@shared/PromptFolder'
  import PromptFolderNameDialog from './PromptFolderNameDialog.svelte'

  let {
    isWorkspaceReady,
    promptFolders = [],
    isPromptFolderListLoading,
    onCreated
  } = $props<{
    isWorkspaceReady: boolean
    promptFolders: PromptFolder[]
    isPromptFolderListLoading: boolean
    onCreated?: (promptFolderId: string) => void
  }>()

  const workspaceSelection = getWorkspaceSelectionContext()
  let promptFolderNameDialog = $state<{ openDialog: () => void } | null>(null)

  export const openDialog = () => {
    promptFolderNameDialog?.openDialog()
  }

  const getCreatedPromptFolderId = (workspaceId: string, folderName: string): string | null => {
    const workspace = workspaceCollection.get(workspaceId)

    if (!workspace) {
      return null
    }

    for (const entry of workspace.entries) {
      const promptFolder = promptFolderCollection.get(entry.id)

      if (promptFolder?.folderName === folderName) {
        return promptFolder.id
      }
    }

    return null
  }

  const handleCreateFolder = async (
    normalizedDisplayName: string,
    folderName: string
  ): Promise<boolean> => {
    const selectedWorkspaceId = workspaceSelection.selectedWorkspaceId
    if (!selectedWorkspaceId) return false

    const wasCreated = await runIpcBestEffort(
      async () => {
        await createPromptFolder(selectedWorkspaceId, normalizedDisplayName)
        const createdPromptFolderId = getCreatedPromptFolderId(selectedWorkspaceId, folderName)

        if (createdPromptFolderId) {
          onCreated?.(createdPromptFolderId)
        }

        return true
      },
      () => false
    )

    return wasCreated
  }
</script>

<PromptFolderNameDialog
  bind:this={promptFolderNameDialog}
  {isWorkspaceReady}
  {promptFolders}
  {isPromptFolderListLoading}
  title="Create Prompt Folder"
  submitText="Create Folder"
  submittingText="Creating..."
  submitTestId="create-prompt-folder-button"
  inputTestId="create-prompt-folder-name-input"
  errorTestId="create-prompt-folder-name-error"
  rowDetail="Name the new prompt folder."
  failureMessage="Failed to create folder. Please try again."
  onsubmit={handleCreateFolder}
/>
