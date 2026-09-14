<script lang="ts">
  import Dialog from '@renderer/common/cthulhu-ui/Dialog.svelte'
  import FolderInput from '@renderer/common/cthulhu-ui/FolderInput.svelte'
  import FloatingValidationMessage from '@renderer/common/cthulhu-ui/FloatingValidationMessage.svelte'
  import MessageRow from '@renderer/common/cthulhu-ui/MessageRow.svelte'
  import Subtitle from '@renderer/common/cthulhu-ui/Subtitle.svelte'
  import TextInput from '@renderer/common/cthulhu-ui/TextInput.svelte'
  import Title from '@renderer/common/cthulhu-ui/Title.svelte'
  import TitleSubtitleStack from '@renderer/common/cthulhu-ui/TitleSubtitleStack.svelte'
  import ToggleTextButton from '@renderer/common/cthulhu-ui/ToggleTextButton.svelte'
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
  class="w-full max-w-[620px]"
  icon={FolderPlus}
  title="Create Workspace"
  subtitle="Choose a name and location for your new workspace."
  submitText={isWorkspaceLoading ? 'Creating...' : 'Create Workspace'}
  submitDisabled={!canCreateWorkspace}
  submitTestId="create-workspace-submit-button"
  submitVariant="accent"
  oncancel={resetDialog}
  cancelDisabled={isWorkspaceLoading}
  onsubmit={handleCreateWorkspace}
>
  <!-- Standard stacked dialog fields for workspace creation options. -->
  <div class="cthulhuCreateWorkspaceFields grid min-w-0 gap-[17px] px-4 py-4">
    <div data-testid="create-workspace-name-field">
      <TitleSubtitleStack class="mb-[7px]">
        <div class="flex items-center gap-1">
          <Title title="Workspace Name" variant="small" />
          <span class="text-sm leading-5 text-[var(--ui-muted-text)]">*</span>
        </div>
        <Subtitle id="create-workspace-name-help" text="Enter a name for the new workspace." />
      </TitleSubtitleStack>
      <FloatingValidationMessage
        message={displayedWorkspaceNameError}
        textTestId="create-workspace-name-error"
      >
        <TextInput
          id="create-workspace-name-input"
          class="w-full"
          bind:value={workspaceName}
          aria-label="Workspace Name"
          aria-describedby="create-workspace-name-help"
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
    </div>

    <div data-testid="create-workspace-containing-folder-field">
      <TitleSubtitleStack class="mb-[7px]">
        <Title title="Containing Folder" variant="small" />
        <Subtitle
          id="create-workspace-containing-folder-help"
          text="Choose the folder that will contain the workspace."
        />
      </TitleSubtitleStack>
      <FolderInput
        class="w-full"
        bind:value={containingFolder}
        inputId="create-workspace-containing-folder-input"
        inputTestId="create-workspace-containing-folder-display"
        inputAriaLabel="Containing Folder"
        inputAriaDescribedby="create-workspace-containing-folder-help"
        ariaLabel="Browse for containing folder"
        buttonTestId="create-workspace-path-browse-button"
        disabled={isWorkspaceLoading}
      />
    </div>

    <div data-testid="create-workspace-final-path-field">
      <TitleSubtitleStack class="mb-[7px]">
        <Title title="Workspace Path" variant="small" />
        <Subtitle
          id="create-workspace-final-path-help"
          text="Review the full path to the workspace."
        />
      </TitleSubtitleStack>
      <TextInput
        id="create-workspace-final-path-input"
        class="w-full"
        value={finalWorkspacePath}
        aria-label="Workspace Path"
        aria-describedby="create-workspace-final-path-help"
        aria-invalid={hasExistingWorkspace ? 'true' : undefined}
        data-testid="create-workspace-final-path-display"
        disabled
      />
    </div>

    {#if finalPathMessage}
      <MessageRow
        text={finalPathMessage}
        variant={finalPathMessageVariant}
        textTestId="create-workspace-final-path-message"
        class="w-full"
      />
    {/if}

    {#if submissionError}
      <MessageRow
        text={submissionError}
        variant="danger"
        textTestId="create-workspace-submit-error"
        class="w-full"
      />
    {/if}

    <div data-testid="create-workspace-examples-row">
      <TitleSubtitleStack class="mb-[7px]">
        <Title title="Add Examples" variant="small" />
        <Subtitle
          text="Include example prompts and templates in the My Prompts and My Templates folders."
        />
      </TitleSubtitleStack>
      <ToggleTextButton
        testId="create-workspace-examples-toggle"
        pressed={includeExamples}
        disabled={isWorkspaceLoading}
        onclick={() => {
          includeExamples = !includeExamples
        }}
      />
    </div>
  </div>
</Dialog>

<style>
  .cthulhuCreateWorkspaceFields {
    overflow: visible;
  }
</style>
