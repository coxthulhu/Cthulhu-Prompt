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
  const targetOwner = $derived(
    promptFolders.find((folder) => folder.id === target?.ownerFolderId) ?? null
  )
  const isTemplateFolder = $derived(targetOwner?.kind === 'template')
  let promptFolderNameDialog = $state<{ openDialog: () => void } | null>(null)
  const siblingPromptFolders = $derived.by(() => {
    if (!target) return []
    const owner = targetOwner
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
    if (!workspaceId || !selectedTarget || !targetOwner) return false

    return await runIpcBestEffort(
      async () => {
        const createdPromptFolderId = await createPromptFolder(
          workspaceId,
          normalizedDisplayName,
          selectedTarget.ownerFolderId,
          selectedTarget.previousEntryId,
          targetOwner.kind
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
  title={isTemplateFolder ? 'Create Prompt Template Subfolder' : 'Create Prompt Subfolder'}
  subtitle={isTemplateFolder
    ? 'Add a new subfolder to this prompt template folder.'
    : 'Add a new subfolder to this prompt folder.'}
  submitText="Create Subfolder"
  submittingText="Creating..."
  submitTestId="create-prompt-subfolder-button"
  inputTestId="create-prompt-subfolder-name-input"
  errorTestId="create-prompt-subfolder-name-error"
  rowLabel={isTemplateFolder ? 'Prompt Template Folder Name' : 'Prompt Folder Name'}
  rowDetail={isTemplateFolder
    ? 'Name the new template subfolder.'
    : 'Name the new prompt subfolder.'}
  failureMessage={isTemplateFolder
    ? 'Failed to create prompt template subfolder. Please try again.'
    : 'Failed to create prompt subfolder. Please try again.'}
  onsubmit={handleCreateSubfolder}
/>
