<script lang="ts">
  import { tick } from 'svelte'
  import { FolderPlus } from 'lucide-svelte'
  import type { Category } from '@shared/Category'
  import {
    hasCategoryDisplayNameConflict,
    normalizeCategoryDisplayName
  } from '@shared/Category'
  import Dialog from '@renderer/common/cthulhu-ui/Dialog.svelte'
  import FloatingValidationMessage from '@renderer/common/cthulhu-ui/FloatingValidationMessage.svelte'
  import SettingRow from '@renderer/common/cthulhu-ui/SettingRow.svelte'
  import TextInput from '@renderer/common/cthulhu-ui/TextInput.svelte'

  /** Input contract for category creation and rename dialogs. */
  type Props = {
    categories: Category[]
    isWorkspaceReady: boolean
    excludedCategoryId?: string | null
    dialogTitle?: string
    dialogSubtitle?: string
    submitLabel?: string
    submittingLabel?: string
    failureMessage?: string
    testIdPrefix?: 'create' | 'rename'
    onsubmit: (displayName: string) => Promise<boolean>
  }

  /** Reactive inputs supplied by the active root folder screen. */
  let {
    categories,
    isWorkspaceReady,
    excludedCategoryId = null,
    dialogTitle = 'Create Category',
    dialogSubtitle = 'Add a category to this root folder.',
    submitLabel = 'Create Category',
    submittingLabel = 'Creating...',
    failureMessage = 'Failed to create category. Please try again.',
    testIdPrefix = 'create',
    onsubmit
  }: Props = $props()
  /** Controls whether the modal is currently visible. */
  let isDialogOpen = $state(false)
  /** Editable category display name. */
  let displayName = $state('')
  /** Tracks whether validation should be shown below the input. */
  let hasInteracted = $state(false)
  /** Prevents duplicate submissions while category IPC is pending. */
  let isSubmitting = $state(false)
  /** Holds a failed persistence message until the user edits again. */
  let submissionError = $state<string | null>(null)
  /** Input element focused whenever the modal opens. */
  let inputElement = $state<HTMLInputElement | null>(null)
  /** Trimmed category name used by validation and persistence. */
  const normalizedDisplayName = $derived(normalizeCategoryDisplayName(displayName))
  /** Validation message for required and root-unique category names. */
  const validationMessage = $derived(
    normalizedDisplayName.length === 0
      ? 'Category name is required'
      : hasCategoryDisplayNameConflict(
          categories,
          normalizedDisplayName,
          excludedCategoryId
        )
        ? 'A category with this name already exists'
        : null
  )
  /** Message currently visible beneath the category name field. */
  const errorMessage = $derived(
    submissionError ?? (hasInteracted && !isSubmitting ? validationMessage : null)
  )
  /** Submission availability after local category-name validation. */
  const isValid = $derived(
    isWorkspaceReady && !isSubmitting && validationMessage === null
  )

  /** Opens the category dialog for the current root folder. */
  export const openDialog = (initialDisplayName = ''): void => {
    if (!isWorkspaceReady) return
    displayName = initialDisplayName
    hasInteracted = false
    submissionError = null
    isDialogOpen = true
  }

  /** Resets all transient category dialog state. */
  const resetDialog = (): void => {
    isDialogOpen = false
    displayName = ''
    hasInteracted = false
    submissionError = null
  }

  /** Persists a validated category and closes after success. */
  const handleSubmit = async (): Promise<void> => {
    if (!isValid) return
    isSubmitting = true
    submissionError = null
    const didCreate = await onsubmit(normalizedDisplayName)
    if (didCreate) resetDialog()
    else submissionError = failureMessage
    isSubmitting = false
  }

  /** Closes the category dialog without persisting input. */
  const handleCancel = (): void => {
    if (!isSubmitting) resetDialog()
  }

  // Side effect: focus and select the category name after the dialog enters the DOM.
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
  class="w-full max-w-[540px]"
  icon={FolderPlus}
  title={dialogTitle}
  subtitle={dialogSubtitle}
  submitText={isSubmitting ? submittingLabel : submitLabel}
  submitDisabled={!isValid}
  cancelDisabled={isSubmitting}
  submitTestId={`${testIdPrefix}-category-button`}
  submitVariant="accent"
  closeOnOutsideClick={false}
  oncancel={handleCancel}
  onsubmit={handleSubmit}
>
  <div class="cthulhuCreateCategoryDialogRows flex min-w-0 flex-col">
    <SettingRow icon={FolderPlus} label="Category Name" detail="Name the new category.">
      {#snippet control()}
        <FloatingValidationMessage
          message={errorMessage}
          textTestId={`${testIdPrefix}-category-name-error`}
        >
          <TextInput
            bind:ref={inputElement}
            id={`${testIdPrefix}-category-name-input`}
            class="w-[220px]"
            data-testid={`${testIdPrefix}-category-name-input`}
            placeholder="Name..."
            bind:value={displayName}
            aria-label="Category Name"
            aria-invalid={errorMessage ? 'true' : undefined}
            disabled={isSubmitting}
            oninput={() => {
              hasInteracted = true
              submissionError = null
            }}
            onkeydown={(event) => {
              if (event.key === 'Enter' && isValid) void handleSubmit()
              else if (event.key === 'Escape') handleCancel()
            }}
          />
        </FloatingValidationMessage>
      {/snippet}
    </SettingRow>
  </div>
</Dialog>

<style>
  .cthulhuCreateCategoryDialogRows {
    overflow: visible;
  }
</style>
