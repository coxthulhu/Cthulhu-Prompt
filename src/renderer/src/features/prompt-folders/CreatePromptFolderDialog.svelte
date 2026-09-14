<script lang="ts">
  import { getWorkspaceSelectionContext } from '@renderer/app/WorkspaceSelectionContext'
  import { createPromptFolder } from '@renderer/data/Mutations/PromptFolderMutations'
  import { runIpcBestEffort } from '@renderer/data/IpcFramework/IpcInvoke'
  import type { PromptFolder, PromptFolderKind } from '@shared/PromptFolder'
  import PromptFolderNameDialog from './PromptFolderNameDialog.svelte'

  let {
    isWorkspaceReady,
    kind,
    promptFolders = [],
    isPromptFolderListLoading,
    onCreated
  } = $props<{
    isWorkspaceReady: boolean
    /** Fixed root-folder kind supplied by the active folder activity. */
    kind: PromptFolderKind
    promptFolders: PromptFolder[]
    isPromptFolderListLoading: boolean
    onCreated?: (promptFolderId: string) => void
  }>()

  const workspaceSelection = getWorkspaceSelectionContext()
  let promptFolderNameDialog = $state<{ openDialog: () => void } | null>(null)
  /** Opens the fixed-kind folder name dialog. */
  export const openDialog = () => {
    promptFolderNameDialog?.openDialog()
  }

  /** Creates one root folder using the activity's fixed kind. */
  const handleCreateFolder = async (normalizedDisplayName: string): Promise<boolean> => {
    const selectedWorkspaceId = workspaceSelection.selectedWorkspaceId
    if (!selectedWorkspaceId) return false

    return await runIpcBestEffort(
      async () => {
        const createdPromptFolderId = await createPromptFolder(
          selectedWorkspaceId,
          normalizedDisplayName,
          null,
          kind
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
  {promptFolders}
  {isPromptFolderListLoading}
  title={kind === 'template'
    ? 'Create Prompt Template Folder'
    : 'Create Task Prompt Folder'}
  subtitle={kind === 'template'
    ? 'Organize reusable prompts for repeatable workflows.'
    : 'Organize one-time prompts for individual tasks.'}
  submitText="Create Folder"
  submittingText="Creating..."
  submitTestId="create-prompt-folder-button"
  inputTestId="create-prompt-folder-name-input"
  errorTestId="create-prompt-folder-name-error"
  rowDetail={kind === 'template'
    ? 'Required. Names must be unique among prompt template folders.'
    : 'Required. Names must be unique among task prompt folders.'}
  failureMessage={kind === 'template'
    ? 'Failed to create prompt template folder. Please try again.'
    : 'Failed to create task prompt folder. Please try again.'}
  onsubmit={handleCreateFolder}
/>
