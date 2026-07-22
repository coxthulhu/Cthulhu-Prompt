<script lang="ts">
  import SettingRow from '@renderer/common/cthulhu-ui/SettingRow.svelte'
  import SimpleSelectorButton, {
    type SimpleSelectorButtonItem
  } from '@renderer/common/cthulhu-ui/SimpleSelectorButton.svelte'
  import { getWorkspaceSelectionContext } from '@renderer/app/WorkspaceSelectionContext'
  import { createPromptFolder } from '@renderer/data/Mutations/PromptFolderMutations'
  import { runIpcBestEffort } from '@renderer/data/IpcFramework/IpcInvoke'
  import type { PromptFolder, PromptFolderKind } from '@shared/PromptFolder'
  import { FileStack, Folder, Folders } from 'lucide-svelte'
  import PromptFolderNameDialog from './PromptFolderNameDialog.svelte'

  let {
    isWorkspaceReady,
    promptFolders = [],
    promptTemplateFolders = [],
    isPromptFolderListLoading,
    onCreated
  } = $props<{
    isWorkspaceReady: boolean
    promptFolders: PromptFolder[]
    promptTemplateFolders: PromptFolder[]
    isPromptFolderListLoading: boolean
    onCreated?: (promptFolderId: string) => void
  }>()

  const workspaceSelection = getWorkspaceSelectionContext()
  let promptFolderNameDialog = $state<{ openDialog: () => void } | null>(null)
  const folderTypeItems: Array<SimpleSelectorButtonItem & { id: PromptFolderKind }> = [
    {
      id: 'prompt',
      label: 'Prompt Folder',
      detail: 'Store regular one-time prompts',
      icon: Folder
    },
    {
      id: 'template',
      label: 'Prompt Template Folder',
      detail: 'Store reusable prompt templates',
      icon: FileStack
    }
  ]
  let selectedFolderType = $state<(typeof folderTypeItems)[number]>(folderTypeItems[0]!)
  const validationFolders = $derived(
    selectedFolderType.id === 'prompt' ? promptFolders : promptTemplateFolders
  )

  export const openDialog = () => {
    selectedFolderType = folderTypeItems[0]!
    promptFolderNameDialog?.openDialog()
  }

  const handleCreateFolder = async (normalizedDisplayName: string): Promise<boolean> => {
    const selectedWorkspaceId = workspaceSelection.selectedWorkspaceId
    if (!selectedWorkspaceId) return false

    return await runIpcBestEffort(
      async () => {
        const createdPromptFolderId = await createPromptFolder(
          selectedWorkspaceId,
          normalizedDisplayName,
          null,
          null,
          selectedFolderType.id
        )

        if (selectedFolderType.id === 'prompt') {
          onCreated?.(createdPromptFolderId)
        }

        return true
      },
      () => false
    )
  }
</script>

<PromptFolderNameDialog
  bind:this={promptFolderNameDialog}
  {isWorkspaceReady}
  promptFolders={validationFolders}
  {isPromptFolderListLoading}
  title="Create Prompt Folder"
  submitText="Create Folder"
  submittingText="Creating..."
  submitTestId="create-prompt-folder-button"
  inputTestId="create-prompt-folder-name-input"
  errorTestId="create-prompt-folder-name-error"
  dialogClass="w-full max-w-[600px]"
  rowDetail="Name the new prompt folder."
  failureMessage="Failed to create folder. Please try again."
  onsubmit={handleCreateFolder}
>
  {#snippet beforeRows()}
    <SettingRow
      icon={Folders}
      label="Folder Type"
      detail="Choose what the root folder will contain."
    >
      {#snippet control()}
        <SimpleSelectorButton
          label="Prompt folder type"
          items={folderTypeItems}
          selectedItem={selectedFolderType}
          showIcon
          valueWidth="190px"
          testId="create-prompt-folder-type-selector"
          menuTestId="create-prompt-folder-type-menu"
          onselect={(item) => {
            selectedFolderType = item as (typeof folderTypeItems)[number]
          }}
        />
      {/snippet}
    </SettingRow>
  {/snippet}
</PromptFolderNameDialog>
