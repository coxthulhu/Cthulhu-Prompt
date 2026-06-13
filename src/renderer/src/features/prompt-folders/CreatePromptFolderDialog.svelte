<script lang="ts">
  import { getWorkspaceSelectionContext } from '@renderer/app/WorkspaceSelectionContext'
  import Dialog from '@renderer/common/cthulhu-ui/Dialog.svelte'
  import FloatingValidationMessage from '@renderer/common/cthulhu-ui/FloatingValidationMessage.svelte'
  import SettingRow from '@renderer/common/cthulhu-ui/SettingRow.svelte'
  import TextInput from '@renderer/common/cthulhu-ui/TextInput.svelte'
  import { FolderPlus } from 'lucide-svelte'
  import { promptFolderCollection } from '@renderer/data/Collections/PromptFolderCollection'
  import { workspaceCollection } from '@renderer/data/Collections/WorkspaceCollection'
  import { createPromptFolder } from '@renderer/data/Mutations/PromptFolderMutations'
  import { runIpcBestEffort } from '@renderer/data/IpcFramework/IpcInvoke'
  import type { PromptFolder } from '@shared/PromptFolder'
  import { preparePromptFolderName } from '@shared/promptFolderName'

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

  let isDialogOpen = $state(false)
  const workspaceSelection = getWorkspaceSelectionContext()
  let displayName = $state('')
  let submissionError = $state<string | null>(null)
  let hasInteractedWithInput = $state(false)
  let isCreatingPromptFolder = $state(false)

  export const openDialog = () => {
    if (!isWorkspaceReady) return

    isDialogOpen = true
  }

  const preparedName = $derived(preparePromptFolderName(displayName))
  const validation = $derived(preparedName.validation)
  const normalizedDisplayName = $derived(preparedName.displayName)
  // Derive a sanitized name to detect duplicate prompt folders by on-disk folder name.
  const sanitizedFolderName = $derived(preparedName.folderName.toLowerCase())
  const hasDuplicateFolderName = $derived.by(
    () =>
      validation.isValid &&
      !isPromptFolderListLoading &&
      Boolean(sanitizedFolderName) &&
      promptFolders.some((folder) => folder.folderName.toLowerCase() === sanitizedFolderName)
  )
  const validationMessage = $derived(
    !validation.isValid
      ? (validation.errorMessage ?? null)
      : hasDuplicateFolderName
        ? 'A folder with this name already exists'
        : null
  )
  const errorMessage = $derived(
    submissionError ??
      (!isCreatingPromptFolder && hasInteractedWithInput ? validationMessage : null)
  )
  const isValid = $derived(
    Boolean(
      !validationMessage && validation.isValid && isWorkspaceReady && !isPromptFolderListLoading
    )
  )

  const resetDialog = () => {
    isDialogOpen = false
    displayName = ''
    submissionError = null
    hasInteractedWithInput = false
  }

  const getCreatedPromptFolderId = (workspaceId: string, folderName: string): string | null => {
    const workspace = workspaceCollection.get(workspaceId)

    if (!workspace) {
      return null
    }

    for (const promptFolderId of workspace.promptFolderIds) {
      const promptFolder = promptFolderCollection.get(promptFolderId)

      if (promptFolder?.folderName === folderName) {
        return promptFolder.id
      }
    }

    return null
  }

  const handleCreateFolder = async () => {
    if (!isValid) return

    const selectedWorkspaceId = workspaceSelection.selectedWorkspaceId
    if (!selectedWorkspaceId) return

    submissionError = null
    isCreatingPromptFolder = true

    const wasCreated = await runIpcBestEffort(
      async () => {
        await createPromptFolder(selectedWorkspaceId, normalizedDisplayName)
        const createdPromptFolderId = getCreatedPromptFolderId(
          selectedWorkspaceId,
          preparedName.folderName
        )

        if (createdPromptFolderId) {
          onCreated?.(createdPromptFolderId)
        }

        resetDialog()
        return true
      },
      () => false
    )

    if (!wasCreated) {
      submissionError = 'Failed to create folder. Please try again.'
    }

    isCreatingPromptFolder = false
  }

  const handleCancel = () => {
    if (isCreatingPromptFolder) return

    resetDialog()
  }
</script>

<Dialog
  bind:open={isDialogOpen}
  class="w-full max-w-[540px]"
  title="Create Prompt Folder"
  submitText={isCreatingPromptFolder ? 'Creating...' : 'Create Folder'}
  submitDisabled={!isValid || isCreatingPromptFolder}
  cancelDisabled={isCreatingPromptFolder}
  submitTestId="create-prompt-folder-button"
  submitVariant="accent"
  closeOnOutsideClick={false}
  oncancel={handleCancel}
  onsubmit={handleCreateFolder}
>
  <div class="cthulhuCreatePromptFolderRows flex min-w-0 flex-col">
    <SettingRow
      icon={FolderPlus}
      label="Prompt Folder Name"
      detail="Name the new prompt folder."
    >
      {#snippet control()}
        <FloatingValidationMessage message={errorMessage} textTestId="create-prompt-folder-name-error">
          <TextInput
            id="create-prompt-folder-name-input"
            class="w-[220px]"
            data-testid="create-prompt-folder-name-input"
            placeholder="Name..."
            bind:value={displayName}
            aria-label="Prompt Folder Name"
            aria-invalid={errorMessage ? 'true' : undefined}
            disabled={isCreatingPromptFolder}
            oninput={() => {
              hasInteractedWithInput = true
              submissionError = null
            }}
            onkeydown={(event) => {
              if (event.key === 'Enter' && isValid) {
                handleCreateFolder()
              } else if (event.key === 'Escape') {
                handleCancel()
              }
            }}
          />
        </FloatingValidationMessage>
      {/snippet}
    </SettingRow>
  </div>
</Dialog>

<style>
  .cthulhuCreatePromptFolderRows {
    overflow: visible;
  }
</style>
