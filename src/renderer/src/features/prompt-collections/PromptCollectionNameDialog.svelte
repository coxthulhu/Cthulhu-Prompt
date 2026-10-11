<script lang="ts">
  import { tick } from 'svelte'
  import type { ComponentType } from 'svelte'
  import Dialog from '@renderer/common/cthulhu-ui/dialogs/Dialog.svelte'
  import FloatingValidationMessage from '@renderer/common/cthulhu-ui/forms/FloatingValidationMessage.svelte'
  import Subtitle from '@renderer/common/cthulhu-ui/layout/Subtitle.svelte'
  import TextInput from '@renderer/common/cthulhu-ui/forms/TextInput.svelte'
  import Title from '@renderer/common/cthulhu-ui/layout/Title.svelte'
  import TitleSubtitleStack from '@renderer/common/cthulhu-ui/layout/TitleSubtitleStack.svelte'
  import { FolderPlus } from 'lucide-svelte'
  import type { PromptCollection } from '@shared/domain/prompt-collection/PromptCollection'
  import {
    hasPromptCollectionNameConflict,
    preparePromptCollectionName,
    PROMPT_COLLECTION_NAME_CONFLICT_ERROR
  } from '@shared/domain/prompt-collection/promptCollectionName'

  type SubmitPromptCollectionName = (displayName: string, folderName: string) => Promise<boolean>

  let {
    isWorkspaceReady,
    promptCollections = [],
    isPromptCollectionListLoading,
    title,
    subtitle,
    submitText,
    submittingText,
    submitTestId,
    inputTestId,
    errorTestId,
    rowLabel = 'Collection Name',
    rowDetail,
    initialDisplayName = '',
    unchangedDisplayName = null,
    duplicatePromptCollectionId = null,
    failureMessage,
    icon = FolderPlus,
    onsubmit
  } = $props<{
    isWorkspaceReady: boolean
    promptCollections: PromptCollection[]
    isPromptCollectionListLoading: boolean
    title: string
    subtitle: string
    submitText: string
    submittingText: string
    submitTestId: string
    inputTestId: string
    errorTestId: string
    rowLabel?: string
    rowDetail: string
    initialDisplayName?: string
    unchangedDisplayName?: string | null
    duplicatePromptCollectionId?: string | null
    failureMessage: string
    icon?: ComponentType
    onsubmit: SubmitPromptCollectionName
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

  const preparedName = $derived(preparePromptCollectionName(displayName))
  const validation = $derived(preparedName.validation)
  const normalizedDisplayName = $derived(preparedName.displayName)
  const preparedFolderName = $derived(preparedName.folderName)
  // Display-name edits remain meaningful when the sanitized disk name stays the same.
  const isUnchangedDisplayName = $derived(
    unchangedDisplayName !== null && normalizedDisplayName === unchangedDisplayName
  )
  const hasDuplicateFolderName = $derived.by(
    () =>
      validation.isValid &&
      !isPromptCollectionListLoading &&
      Boolean(preparedFolderName) &&
      hasPromptCollectionNameConflict(promptCollections, preparedFolderName, duplicatePromptCollectionId)
  )
  const validationMessage = $derived(
    !validation.isValid
      ? (validation.errorMessage ?? null)
      : hasDuplicateFolderName
        ? PROMPT_COLLECTION_NAME_CONFLICT_ERROR
        : null
  )
  const errorMessage = $derived(
    submissionError ?? (!isSubmitting && hasInteractedWithInput ? validationMessage : null)
  )
  const inputHelpId = $derived(`${inputTestId}-help`)
  const isValid = $derived(
    Boolean(
      !validationMessage &&
      validation.isValid &&
      isWorkspaceReady &&
      !isPromptCollectionListLoading &&
      !isUnchangedDisplayName
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

  // Side effect: focus and select the collection name once the dialog has mounted.
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
  class="w-full max-w-[520px]"
  icon={icon}
  {title}
  {subtitle}
  submitText={isSubmitting ? submittingText : submitText}
  submitDisabled={!isValid || isSubmitting}
  cancelDisabled={isSubmitting}
  {submitTestId}
  submitVariant="accent"
  oncancel={handleCancel}
  onsubmit={handleSubmit}
>
  <div class="cthulhuPromptCollectionNameDialogFields grid min-w-0 gap-[17px] px-4 py-4">
    <div data-testid="prompt-collection-name-field">
      <TitleSubtitleStack class="mb-[7px]">
        <div class="flex items-center gap-1">
          <Title title={rowLabel} variant="small" />
          <span class="text-sm leading-5 text-[var(--ui-muted-text)]">*</span>
        </div>
        <Subtitle id={inputHelpId} text={rowDetail} />
      </TitleSubtitleStack>
      <FloatingValidationMessage message={errorMessage} textTestId={errorTestId}>
        <TextInput
          bind:ref={inputElement}
          id={inputTestId}
          class="w-full"
          data-testid={inputTestId}
          placeholder="Name..."
          bind:value={displayName}
          aria-label={rowLabel}
          aria-invalid={errorMessage ? 'true' : undefined}
          aria-describedby={inputHelpId}
          disabled={isSubmitting}
          oninput={() => {
            hasInteractedWithInput = true
            submissionError = null
          }}
          onkeydown={(event) => {
            if (event.key === 'Enter' && isValid) {
              handleSubmit()
            }
          }}
        />
      </FloatingValidationMessage>
    </div>
  </div>
</Dialog>

<style>
  .cthulhuPromptCollectionNameDialogFields {
    overflow: visible;
  }
</style>
