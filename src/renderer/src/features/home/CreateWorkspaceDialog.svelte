<script lang="ts">
  import CheckboxInput from '@renderer/common/cthulhu-ui/CheckboxInput.svelte'
  import CthulhuDialog from '@renderer/common/cthulhu-ui/CthulhuDialog.svelte'
  import FileInput from '@renderer/common/cthulhu-ui/FileInput.svelte'
  import FlatFloatingValidationMessage from '@renderer/common/cthulhu-ui/FlatFloatingValidationMessage.svelte'
  import MessageRow from '@renderer/common/cthulhu-ui/MessageRow.svelte'
  import TextInput from '@renderer/common/cthulhu-ui/TextInput.svelte'
  import TitleBlock from '@renderer/common/cthulhu-ui/TitleBlock.svelte'
  import { ipcInvoke, runIpcBestEffort } from '@renderer/data/IpcFramework/IpcInvoke'
  import type { WorkspaceFolderStatus } from '@shared/Workspace'
  import { preparePromptFolderName } from '@shared/promptFolderName'
  import { FolderPlus } from 'lucide-svelte'
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
        ? 'This folder is not empty. Typically, you want to create a workspace in an empty folder.'
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

<CthulhuDialog
  bind:open
  class="w-full max-w-[704px]"
  icon={FolderPlus}
  title="Create Workspace"
  description="Choose the details for your new workspace."
  submitText={isWorkspaceLoading ? 'Creating...' : 'Create Workspace'}
  submitDisabled={!canCreateWorkspace}
  submitTestId="create-workspace-submit-button"
  submitVariant="accent"
  closeOnOutsideClick={false}
  oncancel={resetDialog}
  cancelDisabled={isWorkspaceLoading}
  onsubmit={handleCreateWorkspace}
>
  <div class="space-y-2">
    <TitleBlock title="Workspace Name" size="small" />
    <FlatFloatingValidationMessage
      message={displayedWorkspaceNameError}
      textTestId="create-workspace-name-error"
    >
      <TextInput
        id="create-workspace-name-input"
        class="w-full"
        bind:value={workspaceName}
        aria-label="Workspace Name"
        placeholder="Enter workspace name..."
        data-testid="create-workspace-name-input"
        aria-invalid={displayedWorkspaceNameError ? 'true' : undefined}
        disabled={isWorkspaceLoading}
        oninput={() => {
          hasInteractedWithName = true
          submissionError = null
        }}
      />
    </FlatFloatingValidationMessage>
  </div>

  <div class="space-y-2">
    <TitleBlock title="Containing Folder" size="small" />
    <FileInput
      bind:value={containingFolder}
      aria-label="Containing Folder"
      placeholder="Choose the folder where the workspace folder will be created."
      buttonTestId="create-workspace-path-browse-button"
      data-testid="create-workspace-path-input"
      disabled={isWorkspaceLoading}
    />
  </div>

  <div class="space-y-2">
    <TitleBlock title="Final Workspace Path" size="small" />
    <FlatFloatingValidationMessage
      message={finalPathMessage}
      variant={finalPathMessageVariant}
      textTestId="create-workspace-final-path-message"
    >
      <TextInput
        id="create-workspace-final-path-input"
        class="w-full"
        value={finalWorkspacePath}
        aria-label="Final Workspace Path"
        placeholder="Select a containing folder first..."
        data-testid="create-workspace-final-path-input"
        readonlyDisplay
        aria-invalid={hasExistingWorkspace ? 'true' : undefined}
      />
    </FlatFloatingValidationMessage>
    {#if submissionError}
      <MessageRow
        text={submissionError}
        variant="danger"
        textTestId="create-workspace-submit-error"
        class="w-full"
      />
    {/if}
  </div>

  <div class="space-y-2">
    <TitleBlock title="Add Examples" size="small" />
    <CheckboxInput
      bind:checked={includeExamples}
      label="Include example prompts in a &quot;My Prompts&quot; folder."
      data-testid="create-workspace-examples-checkbox-input"
      inputTestId="create-workspace-examples-checkbox"
    />
  </div>
</CthulhuDialog>
