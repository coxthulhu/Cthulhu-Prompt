<script lang="ts">
  import { tick } from 'svelte'
  import { Folder, Trash2 } from 'lucide-svelte'
  import { createCategoryDescriptionModelUri } from '@renderer/common/Monaco'
  import { getSystemSettingsContext } from '@renderer/app/systemSettingsContext'
  import FloatingValidationMessage from '@renderer/common/cthulhu-ui/FloatingValidationMessage.svelte'
  import IconButton from '@renderer/common/cthulhu-ui/IconButton.svelte'
  import Row from '@renderer/common/cthulhu-ui/Row.svelte'
  import Subtitle from '@renderer/common/cthulhu-ui/Subtitle.svelte'
  import TextInput from '@renderer/common/cthulhu-ui/TextInput.svelte'
  import Title from '@renderer/common/cthulhu-ui/Title.svelte'
  import TitleSubtitleStack from '@renderer/common/cthulhu-ui/TitleSubtitleStack.svelte'
  import AutoSizingMonacoEditor from '../prompt-editor/AutoSizingMonacoEditor.svelte'
  import { getCategoryDescriptionSizingConfig } from './categoryEditorSizing'

  /** Inputs and callbacks for one retained category draft. */
  type Props = {
    categoryId: string
    displayName?: string
    shortDescription?: string
    description?: string
    validationMessage: string | null
    hasInteracted?: boolean
    isSubmitting: boolean
    modelOwnerId: string
    focusRequestId: number | null
    ondelete: () => void
  }

  /** Exact Monaco content height used by the full-description field. */
  const FULL_DESCRIPTION_EDITOR_HEIGHT_PX = 176

  /** Reactive category draft fields supplied by the management dialog. */
  let {
    categoryId,
    displayName = $bindable(''),
    shortDescription = $bindable(''),
    description = $bindable(''),
    validationMessage,
    hasInteracted = $bindable(false),
    isSubmitting,
    modelOwnerId,
    focusRequestId,
    ondelete
  }: Props = $props()
  /** Current system settings used for Monaco typography. */
  const systemSettings = getSystemSettingsContext()
  /** Monaco typography shared with the former create-category editor. */
  const descriptionSizingConfig = $derived(
    getCategoryDescriptionSizingConfig(systemSettings.promptFontSize)
  )
  /** Stable Monaco model URI for this draft in this dialog session. */
  const descriptionModelUri = $derived(
    createCategoryDescriptionModelUri(`manage-dialog-${modelOwnerId}-${categoryId}`)
  )
  /** Validation message visible after the selected draft has been edited. */
  const errorMessage = $derived(hasInteracted && !isSubmitting ? validationMessage : null)
  /** Measured width supplied to Monaco layout updates. */
  let descriptionEditorWidthPx = $state(0)
  /** Border host shared by Monaco and its overflow widgets. */
  let descriptionEditorHost = $state<HTMLDivElement | null>(null)
  /** Category-name input focused by rename and creation entry points. */
  let inputElement = $state<HTMLInputElement | null>(null)
  /** Last focus request applied to the current input element. */
  let appliedFocusRequestId = $state<number | null>(null)

  // Side effect: focus and select the name when the dialog requests category-name editing.
  $effect(() => {
    if (focusRequestId === null) return
    if (focusRequestId === appliedFocusRequestId) return
    appliedFocusRequestId = focusRequestId
    void (async () => {
      await tick()
      inputElement?.focus()
      inputElement?.select()
    })()
  })

  // Side effect: keep fixed-height Monaco width aligned with the responsive dialog pane.
  $effect(() => {
    if (!descriptionEditorHost) return
    /** Copies the editor host width into Monaco's explicit layout input. */
    const updateDescriptionEditorWidth = (): void => {
      descriptionEditorWidthPx = descriptionEditorHost?.getBoundingClientRect().width ?? 0
    }
    updateDescriptionEditorWidth()
    /** Observes responsive dialog width changes while the selected editor is mounted. */
    const resizeObserver = new ResizeObserver(updateDescriptionEditorWidth)
    resizeObserver.observe(descriptionEditorHost)
    return () => resizeObserver.disconnect()
  })
</script>

<!-- Single-category editor shared by existing and newly staged category drafts. -->
<div class="cthulhuCategoryManagementEditor">
  <Row
    variant="compact-heading"
    icon={Folder}
    label={displayName.trim() || 'New Category'}
    detail="Category settings"
    class="mb-[22px]"
  >
    {#snippet trailing()}
      <IconButton
        icon={Trash2}
        label="Delete category"
        title="Delete category"
        hoverVariant="danger"
        testId="manage-categories-delete-button"
        disabled={isSubmitting}
        onclick={ondelete}
      />
    {/snippet}
  </Row>

  <div class="grid gap-[17px]">
    <div>
      <TitleSubtitleStack class="mb-[7px]">
        <div class="flex items-center gap-1">
          <Title title="Category Name" variant="small" />
          <span class="text-sm leading-5 text-[var(--ui-muted-text)]">*</span>
        </div>
        <Subtitle
          id="manage-category-name-help"
          text="Required. Names must be unique in this folder."
        />
      </TitleSubtitleStack>
      <FloatingValidationMessage
        message={errorMessage}
        textTestId="manage-category-name-error"
      >
        <TextInput
          bind:ref={inputElement}
          id="manage-category-name-input"
          class="w-full"
          data-testid="manage-category-name-input"
          bind:value={displayName}
          aria-label="Category Name"
          aria-invalid={errorMessage ? 'true' : undefined}
          aria-describedby="manage-category-name-help"
          disabled={isSubmitting}
          oninput={() => {
            hasInteracted = true
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
        id="manage-category-short-description-input"
        class="w-full"
        data-testid="manage-category-short-description-input"
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
        class="cthulhuCategoryManagementDescriptionEditor overflow-hidden rounded-[var(--cthulhu-ui-radius-control)] border bg-[var(--ui-editor-content-surface)]"
        data-testid="manage-category-full-description-input"
      >
        {#if descriptionEditorHost}
          <AutoSizingMonacoEditor
            class="bg-[var(--ui-editor-content-surface)]"
            initialValue={description}
            modelUri={descriptionModelUri}
            containerWidthPx={descriptionEditorWidthPx}
            overflowWidgetsDomNode={descriptionEditorHost}
            rowId={`manage-category-full-description-${categoryId}`}
            sizingConfig={descriptionSizingConfig}
            fixedHeightPx={FULL_DESCRIPTION_EDITOR_HEIGHT_PX}
            ariaLabel="Full Description"
            findSectionKey={`manage-category-full-description-${categoryId}`}
            onChange={(value) => {
              description = value
            }}
          />
        {/if}
      </div>
    </div>
  </div>
</div>

<style>
  .cthulhuCategoryManagementEditor {
    min-width: 0;
  }

  .cthulhuCategoryManagementDescriptionEditor {
    border-color: var(--ui-neutral-normal-border);
  }
</style>
