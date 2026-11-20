<script lang="ts">
  import Dialog from '@renderer/common/cthulhu-ui/dialogs/Dialog.svelte'
  import FloatingValidationMessage from '@renderer/common/cthulhu-ui/forms/FloatingValidationMessage.svelte'
  import MessageRow from '@renderer/common/cthulhu-ui/layout/MessageRow.svelte'
  import Subtitle from '@renderer/common/cthulhu-ui/layout/Subtitle.svelte'
  import TextInput from '@renderer/common/cthulhu-ui/forms/TextInput.svelte'
  import Title from '@renderer/common/cthulhu-ui/layout/Title.svelte'
  import TitleSubtitleStack from '@renderer/common/cthulhu-ui/layout/TitleSubtitleStack.svelte'
  import ToggleButton from '@renderer/common/cthulhu-ui/buttons/ToggleButton.svelte'
  import { prepareWorkspaceName, type WorkspaceListEntry } from '@shared/domain/workspace/Workspace'
  import { FolderPlus } from 'lucide-svelte'
  import type { WorkspaceCreationResult } from '@renderer/features/workspace/types'

  let {
    open = $bindable(false),
    isWorkspaceLoading,
    workspaces,
    onWorkspaceCreate
  } = $props<{
    open?: boolean
    workspaces: WorkspaceListEntry[]
    isWorkspaceLoading: boolean
    onWorkspaceCreate: (
      workspaceName: string,
      includeExamplePrompts: boolean
    ) => Promise<WorkspaceCreationResult>
  }>()

  /** Name used for both the workspace label and its managed filename. */
  let workspaceName = $state('')
  /** Include the bundled examples when seeding the starter collections. */
  let includeExamples = $state(true)
  /** Delay validation feedback until the name has been edited. */
  let hasInteractedWithName = $state(false)
  /** Creation errors keep the dialog open with its current input. */
  let submissionError = $state<string | null>(null)

  /** Validate against the current profile's catalog as the name changes. */
  const workspaceNameError = $derived(prepareWorkspaceName(workspaceName, workspaces).error)
  /** Show the inline error only after the user has edited the name. */
  const displayedWorkspaceNameError = $derived(hasInteractedWithName ? workspaceNameError : null)
  /** Both live name validation and the current creation request gate submission. */
  const submitDisabled = $derived(Boolean(workspaceNameError || isWorkspaceLoading))

  /** Restore the defaults for the next creation attempt. */
  const resetDialog = () => {
    open = false
    workspaceName = ''
    includeExamples = true
    hasInteractedWithName = false
    submissionError = null
  }

  /** Create and select the managed workspace through the shell. */
  const handleCreateWorkspace = async () => {
    if (submitDisabled) {
      return
    }

    submissionError = null

    /** The shell reports persistence errors to this dialog. */
    const creationResult = await onWorkspaceCreate(
      workspaceName.trim(),
      includeExamples
    )
    if (creationResult.success) {
      resetDialog()
      return
    }

    submissionError = creationResult.message
  }

</script>

<Dialog
  bind:open
  class="w-full max-w-[620px]"
  icon={FolderPlus}
  title="Create Workspace"
  subtitle="Choose a name for your new workspace."
  submitText={isWorkspaceLoading ? 'Creating...' : 'Create Workspace'}
  {submitDisabled}
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
          text="Include example prompts and templates in the My Prompts and My Templates collections."
        />
      </TitleSubtitleStack>
      <ToggleButton
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
