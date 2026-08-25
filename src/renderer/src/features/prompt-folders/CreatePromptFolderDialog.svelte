<script lang="ts">
  import SettingRow from '@renderer/common/cthulhu-ui/SettingRow.svelte'
  import SimpleSelectorButton, {
    type SimpleSelectorButtonItem
  } from '@renderer/common/cthulhu-ui/SimpleSelectorButton.svelte'
  import { getWorkspaceSelectionContext } from '@renderer/app/WorkspaceSelectionContext'
  import { createPromptFolder } from '@renderer/data/Mutations/PromptFolderMutations'
  import { runIpcBestEffort } from '@renderer/data/IpcFramework/IpcInvoke'
  import type { PromptFolder, PromptFolderKind } from '@shared/PromptFolder'
  import { Folder, Folders, Layers } from 'lucide-svelte'
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
      detail: 'Store and organize prompts',
      icon: Folder
    },
    {
      id: 'template',
      label: 'Prompt Template Folder',
      detail: 'Store reusable prompt templates',
      icon: Layers
    }
  ]
  let selectedFolderType = $state<(typeof folderTypeItems)[number]>(folderTypeItems[0]!)
  const validationFolders = $derived(
    selectedFolderType.id === 'template' ? promptTemplateFolders : promptFolders
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
          selectedFolderType.id
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
  promptFolders={validationFolders}
  {isPromptFolderListLoading}
  title={selectedFolderType.id === 'template'
    ? 'Create Prompt Template Folder'
    : 'Create Prompt Folder'}
  subtitle="Choose the folder type and name for the new folder."
  submitText="Create Folder"
  submittingText="Creating..."
  submitTestId="create-prompt-folder-button"
  inputTestId="create-prompt-folder-name-input"
  errorTestId="create-prompt-folder-name-error"
  dialogClass="w-full max-w-[600px]"
  rowLabel={selectedFolderType.id === 'template'
    ? 'Prompt Template Folder Name'
    : 'Prompt Folder Name'}
  rowDetail={selectedFolderType.id === 'template'
    ? 'Name the new prompt template folder.'
    : 'Name the new prompt folder.'}
  failureMessage={selectedFolderType.id === 'template'
    ? 'Failed to create prompt template folder. Please try again.'
    : 'Failed to create prompt folder. Please try again.'}
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
