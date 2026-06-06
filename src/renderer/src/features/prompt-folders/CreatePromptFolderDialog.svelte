<script lang="ts">
  import { getWorkspaceSelectionContext } from '@renderer/app/WorkspaceSelectionContext'
  import FlatDialog from '@renderer/common/cthulhu-ui/FlatDialog.svelte'
  import FlatFloatingValidationMessage from '@renderer/common/cthulhu-ui/FlatFloatingValidationMessage.svelte'
  import FlatSettingRow from '@renderer/common/cthulhu-ui/FlatSettingRow.svelte'
  import FlatTextInput from '@renderer/common/cthulhu-ui/FlatTextInput.svelte'
  import IconOnlyButton from '@renderer/common/cthulhu-ui/IconOnlyButton.svelte'
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

<IconOnlyButton
  icon={FolderPlus}
  label="New Prompt Folder"
  title="New Prompt Folder"
  variant="transparent"
  size="compact"
  disabled={!isWorkspaceReady}
  testId="new-prompt-folder-button"
  class="text-[var(--ui-secondary-icon-glyph)] hover:text-[var(--ui-hoverable-icon-glyph)]"
  onclick={() => (isDialogOpen = true)}
/>

<FlatDialog
  bind:open={isDialogOpen}
  class="w-full max-w-[540px]"
  title="Create Prompt Folder"
  submitText={isCreatingPromptFolder ? 'Creating...' : 'Create Folder'}
  submitDisabled={!isValid || isCreatingPromptFolder}
  cancelDisabled={isCreatingPromptFolder}
  submitTestId="create-folder-button"
  submitVariant="accent"
  closeOnOutsideClick={false}
  oncancel={handleCancel}
  onsubmit={handleCreateFolder}
>
  <div class="cthulhuCreatePromptFolderRows flex min-w-0 flex-col">
    <FlatSettingRow
      icon={FolderPlus}
      label="Prompt Folder Name"
      detail="Name the new prompt folder."
    >
      {#snippet control()}
        <FlatFloatingValidationMessage message={errorMessage} textTestId="folder-name-error">
          <FlatTextInput
            id="folder-name-input"
            class="w-[220px]"
            data-testid="folder-name-input"
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
        </FlatFloatingValidationMessage>
      {/snippet}
    </FlatSettingRow>
  </div>
</FlatDialog>

<style>
  .cthulhuCreatePromptFolderRows {
    overflow: visible;
  }
</style>
