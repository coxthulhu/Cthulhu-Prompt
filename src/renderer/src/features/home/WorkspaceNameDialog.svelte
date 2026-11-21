<script lang="ts">
  import { untrack } from 'svelte'
  import Dialog from '@renderer/common/cthulhu-ui/dialogs/Dialog.svelte'
  import FloatingValidationMessage from '@renderer/common/cthulhu-ui/forms/FloatingValidationMessage.svelte'
  import MessageRow from '@renderer/common/cthulhu-ui/layout/MessageRow.svelte'
  import Subtitle from '@renderer/common/cthulhu-ui/layout/Subtitle.svelte'
  import TextInput from '@renderer/common/cthulhu-ui/forms/TextInput.svelte'
  import Title from '@renderer/common/cthulhu-ui/layout/Title.svelte'
  import TitleSubtitleStack from '@renderer/common/cthulhu-ui/layout/TitleSubtitleStack.svelte'
  import ToggleButton from '@renderer/common/cthulhu-ui/buttons/ToggleButton.svelte'
  import { prepareWorkspaceName, type WorkspaceListEntry } from '@shared/domain/workspace/Workspace'
  import { FolderPlus, Pencil } from 'lucide-svelte'
  import type { WorkspaceSelectionResult } from '@renderer/features/workspace/types'

  /** Shared workspace name form, mounted fresh for each Create or Rename action. */
  let {
    mode, initialName = '', onclose,
    isWorkspaceLoading,
    workspaces,
    onsave
  } = $props<{
    mode: 'create' | 'rename'
    initialName?: string
    onclose: () => void
    workspaces: WorkspaceListEntry[]
    isWorkspaceLoading: boolean
    onsave: (
      workspaceName: string,
      includeExamplePrompts: boolean
    ) => Promise<WorkspaceSelectionResult>
  }>()

  /** Name used for both the workspace label and its managed filename. */
  let workspaceName = $state(untrack(() => initialName))
  /** Include the bundled examples when seeding the starter collections. */
  let includeExamples = $state(true)
  /** Delay validation feedback until the name has been edited. */
  let hasInteractedWithName = $state(false)
  /** A failed save leaves the name available for correction or retry. */
  let submissionError = $state<string | null>(null)

  /** Validate against the current profile's catalog as the name changes. */
  const workspaceNameError = $derived(prepareWorkspaceName(workspaceName, workspaces).error)
  /** Show the inline error only after the user has edited the name. */
  const displayedWorkspaceNameError = $derived(hasInteractedWithName ? workspaceNameError : null)
  /** A rename needs an actual name change and both actions require a valid name. */
  const submitDisabled = $derived(Boolean(workspaceNameError || isWorkspaceLoading || workspaceName.trim() === initialName))
  /** Each operation keeps its own action label while a save is in progress. */
  const submitText = $derived(mode === 'create'
    ? isWorkspaceLoading ? 'Creating...' : 'Create Workspace'
    : isWorkspaceLoading ? 'Renaming...' : 'Rename Workspace')

  /** Saves the workspace name and keeps the draft available on failure. */
  const saveWorkspaceName = async () => {
    if (submitDisabled) {
      return
    }

    submissionError = null

    /** The shell reports persistence errors to this dialog. */
    const result = await onsave(workspaceName.trim(), includeExamples)
    if (result.success) onclose()
    else submissionError = result.message
  }

</script>

<Dialog
  open
  class="w-full max-w-[620px]"
  icon={mode === 'create' ? FolderPlus : Pencil}
  title={mode === 'create' ? 'Create Workspace' : 'Rename Workspace'}
  subtitle={mode === 'create' ? 'Choose a name for your new workspace.' : 'Choose a new name for this workspace.'}
  {submitText}
  {submitDisabled}
  submitTestId={mode + '-workspace-submit-button'}
  submitVariant="accent"
  oncancel={onclose}
  cancelDisabled={isWorkspaceLoading}
  onsubmit={saveWorkspaceName}
>
  <div class="grid min-w-0 gap-[17px] overflow-visible px-4 py-4">
    <div data-testid={mode + '-workspace-name-field'}>
      <TitleSubtitleStack class="mb-[7px]">
        <div class="flex items-center gap-1">
          <Title title="Workspace Name" variant="small" />
          <span class="text-sm leading-5 text-[var(--ui-muted-text)]">*</span>
        </div>
        <Subtitle id="workspace-name-help" text="This name is also used for the workspace file." />
      </TitleSubtitleStack>
      <FloatingValidationMessage
        message={displayedWorkspaceNameError}
        textTestId={mode + '-workspace-name-error'}
      >
        <TextInput
          id="workspace-name-input"
          class="w-full"
          bind:value={workspaceName}
          aria-label="Workspace Name"
          aria-describedby="workspace-name-help"
          placeholder="Name..."
          data-testid={mode + '-workspace-name-input'}
          aria-invalid={displayedWorkspaceNameError ? 'true' : undefined}
          disabled={isWorkspaceLoading}
          oninput={() => {
            hasInteractedWithName = true
            submissionError = null
          }}
          onkeydown={(event) => {
            if (mode === 'rename' && event.key === 'Enter' && !event.isComposing) {
              event.preventDefault()
              void saveWorkspaceName()
            }
          }}
        />
      </FloatingValidationMessage>
    </div>

    {#if submissionError}
      <MessageRow
        text={submissionError}
        variant="danger"
        textTestId={mode + '-workspace-submit-error'}
        class="w-full"
      />
    {/if}

    {#if mode === 'create'}
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
    {/if}
  </div>
</Dialog>
