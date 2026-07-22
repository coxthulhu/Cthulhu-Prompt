<script lang="ts">
  import { tick } from 'svelte'
  import type { ComponentType, Snippet } from 'svelte'
  import Dialog from '@renderer/common/cthulhu-ui/Dialog.svelte'
  import FloatingValidationMessage from '@renderer/common/cthulhu-ui/FloatingValidationMessage.svelte'
  import Separator from '@renderer/common/cthulhu-ui/Separator.svelte'
  import SettingRow from '@renderer/common/cthulhu-ui/SettingRow.svelte'
  import TextInput from '@renderer/common/cthulhu-ui/TextInput.svelte'
  import { FolderPlus } from 'lucide-svelte'
  import type { PromptFolder } from '@shared/PromptFolder'
  import {
    hasPromptFolderNameConflict,
    preparePromptFolderName,
    PROMPT_FOLDER_NAME_CONFLICT_ERROR
  } from '@shared/promptFolderName'

  type SubmitPromptFolderName = (displayName: string, folderName: string) => Promise<boolean>

  let {
    isWorkspaceReady,
    promptFolders = [],
    isPromptFolderListLoading,
    title,
    submitText,
    submittingText,
    submitTestId,
    inputTestId,
    errorTestId,
    dialogClass = 'w-full max-w-[540px]',
    rowLabel = 'Prompt Folder Name',
    rowDetail,
    initialDisplayName = '',
    unchangedDisplayName = null,
    unchangedFolderName = null,
    duplicatePromptFolderId = null,
    failureMessage,
    icon = FolderPlus,
    beforeRows,
    onsubmit
  } = $props<{
    isWorkspaceReady: boolean
    promptFolders: PromptFolder[]
    isPromptFolderListLoading: boolean
    title: string
    submitText: string
    submittingText: string
    submitTestId: string
    inputTestId: string
    errorTestId: string
    dialogClass?: string
    rowLabel?: string
    rowDetail: string
    initialDisplayName?: string
    unchangedDisplayName?: string | null
    unchangedFolderName?: string | null
    duplicatePromptFolderId?: string | null
    failureMessage: string
    icon?: ComponentType
    beforeRows?: Snippet
    onsubmit: SubmitPromptFolderName
  }>()

  let isDialogOpen = $state(false)
  let displayName = $state('')
  let submissionError = $state<string | null>(null)
  let hasInteractedWithInput = $state(false)
  let isSubmitting = $state(false)
  let inputElement = $state<HTMLInputElement | null>(null)

  export const openDialog = (nextDisplayName = initialDisplayName) => {
    if (!isWorkspaceReady) return

    displayName = nextDisplayName
    submissionError = null
    hasInteractedWithInput = false
    isDialogOpen = true
  }

  const preparedName = $derived(preparePromptFolderName(displayName))
  const validation = $derived(preparedName.validation)
  const normalizedDisplayName = $derived(preparedName.displayName)
  const preparedFolderName = $derived(preparedName.folderName)
  const isUnchangedFolderName = $derived(
    (unchangedDisplayName !== null && normalizedDisplayName === unchangedDisplayName) ||
      (unchangedFolderName !== null &&
        preparedFolderName.toLowerCase() === unchangedFolderName.toLowerCase())
  )
  const hasDuplicateFolderName = $derived.by(
    () =>
      validation.isValid &&
      !isPromptFolderListLoading &&
      Boolean(preparedFolderName) &&
      hasPromptFolderNameConflict(promptFolders, preparedFolderName, duplicatePromptFolderId)
  )
  const validationMessage = $derived(
    !validation.isValid
      ? (validation.errorMessage ?? null)
      : hasDuplicateFolderName
        ? PROMPT_FOLDER_NAME_CONFLICT_ERROR
        : null
  )
  const errorMessage = $derived(
    submissionError ?? (!isSubmitting && hasInteractedWithInput ? validationMessage : null)
  )
  const isValid = $derived(
    Boolean(
      !validationMessage &&
      validation.isValid &&
      isWorkspaceReady &&
      !isPromptFolderListLoading &&
      !isUnchangedFolderName
    )
  )

  const resetDialog = () => {
    isDialogOpen = false
    displayName = ''
    submissionError = null
    hasInteractedWithInput = false
  }

  const handleSubmit = async () => {
    if (!isValid) return

    submissionError = null
    isSubmitting = true

    const wasSubmitted = await onsubmit(normalizedDisplayName, preparedName.folderName)

    if (wasSubmitted) {
      resetDialog()
    } else {
      submissionError = failureMessage
    }

    isSubmitting = false
  }

  const handleCancel = () => {
    if (isSubmitting) return

    resetDialog()
  }

  // Side effect: focus and select the folder name once the dialog has mounted.
  $effect(() => {
    if (!isDialogOpen) return

    void (async () => {
      await tick()
      inputElement?.focus()
      inputElement?.select()
    })()
  })
</script>

<Dialog
  bind:open={isDialogOpen}
  class={dialogClass}
  {title}
  submitText={isSubmitting ? submittingText : submitText}
  submitDisabled={!isValid || isSubmitting}
  cancelDisabled={isSubmitting}
  {submitTestId}
  submitVariant="accent"
  closeOnOutsideClick={false}
  oncancel={handleCancel}
  onsubmit={handleSubmit}
>
  <div class="cthulhuPromptFolderNameDialogRows flex min-w-0 flex-col">
    {#if beforeRows}
      {@render beforeRows()}
      <Separator />
    {/if}

    <SettingRow {icon} label={rowLabel} detail={rowDetail}>
      {#snippet control()}
        <FloatingValidationMessage message={errorMessage} textTestId={errorTestId}>
          <TextInput
            bind:ref={inputElement}
            id={inputTestId}
            class="w-[220px]"
            data-testid={inputTestId}
            placeholder="Name..."
            bind:value={displayName}
            aria-label={rowLabel}
            aria-invalid={errorMessage ? 'true' : undefined}
            disabled={isSubmitting}
            oninput={() => {
              hasInteractedWithInput = true
              submissionError = null
            }}
            onkeydown={(event) => {
              if (event.key === 'Enter' && isValid) {
                handleSubmit()
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
  .cthulhuPromptFolderNameDialogRows {
    overflow: visible;
  }
</style>
