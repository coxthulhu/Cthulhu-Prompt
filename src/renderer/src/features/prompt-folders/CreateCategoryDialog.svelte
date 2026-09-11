<script lang="ts">
  import { tick } from 'svelte'
  import { FolderPlus } from 'lucide-svelte'
  import type { Category } from '@shared/Category'
  import {
    hasCategoryDisplayNameConflict,
    normalizeCategoryDisplayName,
    normalizeCategoryShortDescription
  } from '@shared/Category'
  import { createCategoryDescriptionModelUri } from '@renderer/common/Monaco'
  import { getSystemSettingsContext } from '@renderer/app/systemSettingsContext'
  import Dialog from '@renderer/common/cthulhu-ui/Dialog.svelte'
  import FloatingValidationMessage from '@renderer/common/cthulhu-ui/FloatingValidationMessage.svelte'
  import Subtitle from '@renderer/common/cthulhu-ui/Subtitle.svelte'
  import TextInput from '@renderer/common/cthulhu-ui/TextInput.svelte'
  import Title from '@renderer/common/cthulhu-ui/Title.svelte'
  import TitleSubtitleStack from '@renderer/common/cthulhu-ui/TitleSubtitleStack.svelte'
  import AutoSizingMonacoEditor from '../prompt-editor/AutoSizingMonacoEditor.svelte'
  import { getCategoryDescriptionSizingConfig } from './categoryEditorSizing'

  /** Input contract for category creation. */
  type Props = {
    categories: Category[]
    isWorkspaceReady: boolean
    onsubmit: (
      displayName: string,
      shortDescription: string | null,
      description: string | null
    ) => Promise<boolean>
  }

  /** Exact Monaco content height used by the full-description field. */
  const FULL_DESCRIPTION_EDITOR_HEIGHT_PX = 176
  /** Component-scoped identity prevents separate create dialogs from sharing draft models. */
  const descriptionModelOwnerId = globalThis.crypto.randomUUID()

  /** Reactive inputs supplied by the active root folder screen. */
  let {
    categories,
    isWorkspaceReady,
    onsubmit
  }: Props = $props()
  /** Current system settings used for Monaco typography. */
  const systemSettings = getSystemSettingsContext()
  /** Monaco typography configuration shared with category description editors. */
  const descriptionSizingConfig = $derived(
    getCategoryDescriptionSizingConfig(systemSettings.promptFontSize)
  )
  /** Controls whether the modal is currently visible. */
  let isDialogOpen = $state(false)
  /** Editable category display name. */
  let displayName = $state('')
  /** Editable optional category summary. */
  let shortDescription = $state('')
  /** Editable optional Markdown category description. */
  let fullDescription = $state('')
  /** Increasing identity keeps each newly opened draft in a fresh Monaco model. */
  let editorSessionId = $state(0)
  /** Measured width supplied to Monaco layout updates. */
  let descriptionEditorWidthPx = $state(0)
  /** Border host shared by the Monaco editor and its overflow widgets. */
  let descriptionEditorHost = $state<HTMLDivElement | null>(null)
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
  /** Trimmed optional summary submitted with a newly created category. */
  const normalizedShortDescription = $derived(
    normalizeCategoryShortDescription(shortDescription)
  )
  /** Full Markdown description, represented as absent when it contains only whitespace. */
  const normalizedFullDescription = $derived(
    fullDescription.trim().length > 0 ? fullDescription : null
  )
  /** Model URI scoped to one opening of the creation dialog. */
  const descriptionModelUri = $derived(
    createCategoryDescriptionModelUri(
      `create-dialog-${descriptionModelOwnerId}-${editorSessionId}`
    )
  )
  /** Validation message for required and root-unique category names. */
  const validationMessage = $derived(
    normalizedDisplayName.length === 0
      ? 'Category name is required'
      : hasCategoryDisplayNameConflict(categories, normalizedDisplayName)
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
  export const openDialog = (): void => {
    if (!isWorkspaceReady) return
    displayName = ''
    shortDescription = ''
    fullDescription = ''
    editorSessionId += 1
    hasInteracted = false
    submissionError = null
    isDialogOpen = true
  }

  /** Resets all transient category dialog state. */
  const resetDialog = (): void => {
    isDialogOpen = false
    displayName = ''
    shortDescription = ''
    fullDescription = ''
    descriptionEditorWidthPx = 0
    hasInteracted = false
    submissionError = null
  }

  /** Persists validated category values and closes after success. */
  const handleSubmit = async (): Promise<void> => {
    if (!isValid) return
    isSubmitting = true
    submissionError = null
    const didCreate = await onsubmit(
      normalizedDisplayName,
      normalizedShortDescription,
      normalizedFullDescription
    )
    if (didCreate) resetDialog()
    else submissionError = 'Failed to create category. Please try again.'
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

  // Side effect: keep fixed-height Monaco width aligned with the responsive dialog.
  $effect(() => {
    if (!isDialogOpen || !descriptionEditorHost) return
    /** Copies the current editor host width into Monaco's explicit layout input. */
    const updateDescriptionEditorWidth = (): void => {
      descriptionEditorWidthPx = descriptionEditorHost?.getBoundingClientRect().width ?? 0
    }
    updateDescriptionEditorWidth()
    /** Observes responsive dialog width changes while the editor is mounted. */
    const resizeObserver = new ResizeObserver(updateDescriptionEditorWidth)
    resizeObserver.observe(descriptionEditorHost)
    return () => resizeObserver.disconnect()
  })
</script>

<Dialog
  bind:open={isDialogOpen}
  class="w-[760px] max-w-[calc(100vw-32px)]"
  icon={FolderPlus}
  title="Create Category"
  subtitle="Add a category to this root folder."
  submitText={isSubmitting ? 'Creating...' : 'Create Category'}
  submitDisabled={!isValid}
  cancelDisabled={isSubmitting}
  submitTestId="create-category-button"
  submitVariant="accent"
  closeOnOutsideClick={false}
  oncancel={handleCancel}
  onsubmit={handleSubmit}
>
  <div class="cthulhuCreateCategoryDialogFields grid gap-[17px] py-4">
    <div>
      <TitleSubtitleStack class="mb-[7px]">
        <div class="flex items-center gap-1">
          <Title title="Category Name" variant="small" />
          <span class="text-sm leading-5 text-[var(--ui-muted-text)]">*</span>
        </div>
        <Subtitle
          id="create-category-name-help"
          text="Required. Names must be unique in this folder."
        />
      </TitleSubtitleStack>
      <FloatingValidationMessage
        message={errorMessage}
        textTestId="create-category-name-error"
      >
        <TextInput
          bind:ref={inputElement}
          id="create-category-name-input"
          class="w-full"
          data-testid="create-category-name-input"
          bind:value={displayName}
          aria-label="Category Name"
          aria-invalid={errorMessage ? 'true' : undefined}
          aria-describedby="create-category-name-help"
          disabled={isSubmitting}
          oninput={() => {
            hasInteracted = true
            submissionError = null
          }}
        />
      </FloatingValidationMessage>
    </div>

    <div>
      <TitleSubtitleStack class="mb-[7px]">
        <Title title="Short Description" variant="small" />
        <Subtitle text="A brief summary to help you recognize this category." />
      </TitleSubtitleStack>
      <TextInput
        id="create-category-short-description-input"
        class="w-full"
        data-testid="create-category-short-description-input"
        bind:value={shortDescription}
        aria-label="Short Description"
        disabled={isSubmitting}
      />
    </div>

    <div>
      <TitleSubtitleStack class="mb-[7px]">
        <Title title="Full Description" variant="small" />
        <Subtitle text="Describe what belongs here and how to use these prompts." />
      </TitleSubtitleStack>
      <div
        bind:this={descriptionEditorHost}
        class="cthulhuCreateCategoryDescriptionEditor overflow-hidden rounded-[var(--cthulhu-ui-radius-control)] border bg-[var(--ui-editor-content-surface)]"
        data-testid="create-category-full-description-input"
      >
        {#if descriptionEditorHost}
          {#key editorSessionId}
            <AutoSizingMonacoEditor
              class="bg-[var(--ui-editor-content-surface)]"
              initialValue={fullDescription}
              modelUri={descriptionModelUri}
              containerWidthPx={descriptionEditorWidthPx}
              overflowWidgetsDomNode={descriptionEditorHost}
              rowId="create-category-full-description"
              sizingConfig={descriptionSizingConfig}
              fixedHeightPx={FULL_DESCRIPTION_EDITOR_HEIGHT_PX}
              ariaLabel="Full Description"
              findSectionKey="create-category-full-description"
              onChange={(value) => {
                fullDescription = value
              }}
            />
          {/key}
        {/if}
      </div>
    </div>
  </div>
</Dialog>

<style>
  .cthulhuCreateCategoryDescriptionEditor {
    border-color: var(--ui-neutral-normal-border);
  }
</style>
