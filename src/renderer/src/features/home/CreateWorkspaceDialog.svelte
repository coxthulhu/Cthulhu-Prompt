<script lang="ts">
  import Dialog from '@renderer/common/cthulhu-ui/Dialog.svelte'
  import FolderInput from '@renderer/common/cthulhu-ui/FolderInput.svelte'
  import FloatingValidationMessage from '@renderer/common/cthulhu-ui/FloatingValidationMessage.svelte'
  import MessageRow from '@renderer/common/cthulhu-ui/MessageRow.svelte'
  import Separator from '@renderer/common/cthulhu-ui/Separator.svelte'
  import SettingRow from '@renderer/common/cthulhu-ui/SettingRow.svelte'
  import TextInput from '@renderer/common/cthulhu-ui/TextInput.svelte'
  import ToggleTextButton from '@renderer/common/cthulhu-ui/ToggleTextButton.svelte'
  import { ipcInvoke, runIpcBestEffort } from '@renderer/data/IpcFramework/IpcInvoke'
  import type { WorkspaceFolderStatus } from '@shared/Workspace'
  import { preparePromptFolderName } from '@shared/promptFolderName'
  import { FolderOpen, Route, Sparkles, Type } from 'lucide-svelte'
  import type { WorkspaceCreationResult } from '@renderer/features/workspace/types'

  let {
    open = $bindable(false),
    isWorkspaceLoading,
    onWorkspaceCreate
  } = $props<{
    open?: boolean
    isWorkspaceLoading: boolean
    onWorkspaceCreate: (
      path: string,
      workspaceName: string,
      includeExamplePrompts: boolean
    ) => Promise<WorkspaceCreationResult>
  }>()

  let workspaceName = $state('')
  let containingFolder = $state('')
  let includeExamples = $state(true)
  let finalFolderStatus = $state<WorkspaceFolderStatus | null>(null)
  let hasInteractedWithName = $state(false)
  let submissionError = $state<string | null>(null)

  const preparedWorkspaceName = $derived(preparePromptFolderName(workspaceName))
  const workspaceNameValidation = $derived(preparedWorkspaceName.validation)
  const workspaceNameError = $derived(
    !workspaceNameValidation.isValid
      ? (workspaceNameValidation.errorMessage ?? '').replaceAll('Folder name', 'Workspace name')
      : null
  )
  const displayedWorkspaceNameError = $derived(hasInteractedWithName ? workspaceNameError : null)
  const trimmedContainingFolder = $derived(containingFolder.trim())
  const finalWorkspacePath = $derived.by(() => {
    if (!trimmedContainingFolder || !preparedWorkspaceName.folderName) {
      return ''
    }

    return `${trimmedContainingFolder.replace(/[\\/]+$/, '')}\\${preparedWorkspaceName.folderName}`
  })
  const hasExistingWorkspace = $derived(finalFolderStatus?.isWorkspace ?? false)
  const hasNonEmptyFinalFolder = $derived(
    Boolean(finalFolderStatus?.exists && !finalFolderStatus.isEmpty && !hasExistingWorkspace)
  )
  const finalPathMessage = $derived(
    hasExistingWorkspace
      ? 'A workspace already exists at this path.'
      : hasNonEmptyFinalFolder
        ? 'This folder is not empty. Typically, you should create a workspace in an empty folder.'
        : null
  )
  const finalPathMessageVariant = $derived(hasExistingWorkspace ? 'danger' : 'warning')
  const canCreateWorkspace = $derived(
    Boolean(
      workspaceNameValidation.isValid &&
      trimmedContainingFolder &&
      finalWorkspacePath &&
      finalFolderStatus &&
      !hasExistingWorkspace &&
      !isWorkspaceLoading
    )
  )

  const resetDialog = () => {
    open = false
    workspaceName = ''
    containingFolder = ''
    includeExamples = true
    finalFolderStatus = null
    hasInteractedWithName = false
    submissionError = null
  }

  const loadFinalFolderStatus = async (path: string): Promise<WorkspaceFolderStatus> => {
    return await ipcInvoke<WorkspaceFolderStatus, string>('get-workspace-folder-status', path)
  }

  const handleCreateWorkspace = async () => {
    if (!canCreateWorkspace) {
      return
    }

    submissionError = null

    const creationResult = await onWorkspaceCreate(
      finalWorkspacePath,
      workspaceName.trim(),
      includeExamples
    )
    if (creationResult.success) {
      resetDialog()
      return
    }

    submissionError = 'Failed to create workspace. Please try again.'
  }

  // Side effect: refresh final-path status any time the derived target path changes.
  $effect(() => {
    const path = finalWorkspacePath
    finalFolderStatus = null

    if (!path) {
      return
    }

    void runIpcBestEffort(
      async () => {
        finalFolderStatus = await loadFinalFolderStatus(path)
      },
      () => {
        finalFolderStatus = { exists: false, isWorkspace: false, isEmpty: true }
        return undefined
      }
    )
  })
</script>

<Dialog
  bind:open
  class="w-full max-w-[608px]"
  title="Create Workspace"
  submitText={isWorkspaceLoading ? 'Creating...' : 'Create Workspace'}
  submitDisabled={!canCreateWorkspace}
  submitTestId="create-workspace-submit-button"
  submitVariant="accent"
  closeOnOutsideClick={false}
  oncancel={resetDialog}
  cancelDisabled={isWorkspaceLoading}
  onsubmit={handleCreateWorkspace}
>
  <div class="cthulhuCreateWorkspaceRows flex min-w-0 flex-col">
    <SettingRow icon={Type} label="Workspace Name" detail="Name the new workspace folder.">
      {#snippet control()}
        <FloatingValidationMessage
          message={displayedWorkspaceNameError}
          textTestId="create-workspace-name-error"
        >
          <TextInput
            id="create-workspace-name-input"
            class="w-[220px]"
            bind:value={workspaceName}
            aria-label="Workspace Name"
            placeholder="Name..."
            data-testid="create-workspace-name-input"
            aria-invalid={displayedWorkspaceNameError ? 'true' : undefined}
            disabled={isWorkspaceLoading}
            oninput={() => {
              hasInteractedWithName = true
              submissionError = null
            }}
          />
        </FloatingValidationMessage>
      {/snippet}
    </SettingRow>

    <Separator />

    <SettingRow
      icon={FolderOpen}
      label="Containing Folder"
      detail="Choose where the workspace folder will be created."
    >
      {#snippet detailExtra()}
        {#if containingFolder}
          <span data-testid="create-workspace-containing-folder-display">{containingFolder}</span>
        {/if}
      {/snippet}

      {#snippet control()}
        <FolderInput
          bind:value={containingFolder}
          ariaLabel="Browse for containing folder"
          buttonTestId="create-workspace-path-browse-button"
          disabled={isWorkspaceLoading}
        />
      {/snippet}
    </SettingRow>

    <Separator />

    <SettingRow
      icon={Route}
      label="Final Workspace Path"
      detail="Review the folder that will be created."
    >
      {#snippet detailExtra()}
        {#if finalWorkspacePath}
          <span
            data-testid="create-workspace-final-path-display"
            aria-invalid={hasExistingWorkspace ? 'true' : undefined}
          >
            {finalWorkspacePath}
          </span>
        {/if}
      {/snippet}
    </SettingRow>

    {#if finalPathMessage}
      <MessageRow
        text={finalPathMessage}
        variant={finalPathMessageVariant}
        textTestId="create-workspace-final-path-message"
        class="mb-3 w-full"
      />
    {/if}

    {#if submissionError}
      <MessageRow
        text={submissionError}
        variant="danger"
        textTestId="create-workspace-submit-error"
        class="mb-3 w-full"
      />
    {/if}

    <Separator />

    <SettingRow
      testId="create-workspace-examples-row"
      icon={Sparkles}
      label="Add Examples"
      detail='Include example prompts in a "My Prompts" folder.'
    >
      {#snippet control()}
        <ToggleTextButton
          testId="create-workspace-examples-toggle"
          pressed={includeExamples}
          disabled={isWorkspaceLoading}
          onclick={() => {
            includeExamples = !includeExamples
          }}
        />
      {/snippet}
    </SettingRow>
  </div>
</Dialog>

<style>
  .cthulhuCreateWorkspaceRows {
    overflow: visible;
  }
</style>
