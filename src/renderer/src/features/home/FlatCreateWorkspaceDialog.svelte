<script lang="ts">
  import FlatDialog from '@renderer/common/cthulhu-ui/FlatDialog.svelte'
  import FlatFolderInput from '@renderer/common/cthulhu-ui/FlatFolderInput.svelte'
  import FlatFloatingValidationMessage from '@renderer/common/cthulhu-ui/FlatFloatingValidationMessage.svelte'
  import FlatMessageRow from '@renderer/common/cthulhu-ui/FlatMessageRow.svelte'
  import FlatSeparator from '@renderer/common/cthulhu-ui/FlatSeparator.svelte'
  import FlatSettingRow from '@renderer/common/cthulhu-ui/FlatSettingRow.svelte'
  import FlatTextInput from '@renderer/common/cthulhu-ui/FlatTextInput.svelte'
  import FlatToggleTextButton from '@renderer/common/cthulhu-ui/FlatToggleTextButton.svelte'
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

<FlatDialog
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
    <FlatSettingRow
      icon={Type}
      label="Workspace Name"
      detail="Name the new workspace folder."
    >
      {#snippet control()}
        <FlatFloatingValidationMessage
          message={displayedWorkspaceNameError}
          textTestId="create-workspace-name-error"
        >
          <FlatTextInput
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
        </FlatFloatingValidationMessage>
      {/snippet}
    </FlatSettingRow>

    <FlatSeparator />

    <FlatSettingRow
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
        <FlatFolderInput
          bind:value={containingFolder}
          ariaLabel="Browse for containing folder"
          buttonTestId="create-workspace-path-browse-button"
          disabled={isWorkspaceLoading}
        />
      {/snippet}
    </FlatSettingRow>

    <FlatSeparator />

    <FlatSettingRow
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
    </FlatSettingRow>

    {#if finalPathMessage}
      <FlatMessageRow
        text={finalPathMessage}
        variant={finalPathMessageVariant}
        textTestId="create-workspace-final-path-message"
        class="mb-3 w-full"
      />
    {/if}

    {#if submissionError}
      <FlatMessageRow
        text={submissionError}
        variant="danger"
        textTestId="create-workspace-submit-error"
        class="mb-3 w-full"
      />
    {/if}

    <FlatSeparator />

    <FlatSettingRow
      testId="create-workspace-examples-row"
      icon={Sparkles}
      label="Add Examples"
      detail='Include example prompts in a "My Prompts" folder.'
    >
      {#snippet control()}
        <FlatToggleTextButton
          testId="create-workspace-examples-toggle"
          pressed={includeExamples}
          disabled={isWorkspaceLoading}
          onclick={() => {
            includeExamples = !includeExamples
          }}
        />
      {/snippet}
    </FlatSettingRow>
  </div>
</FlatDialog>

<style>
  .cthulhuCreateWorkspaceRows {
    overflow: visible;
  }
</style>
