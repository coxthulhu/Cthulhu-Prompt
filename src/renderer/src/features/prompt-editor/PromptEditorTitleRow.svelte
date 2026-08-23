<script module lang="ts">
  import type { ComponentType } from 'svelte'
  import type { ScrollToWithinWindowBand } from '../virtualizer/virtualWindowTypes'

  export type PromptEditorTitleRowProps = {
    /** Prompt or template whose title status line is rendered. */
    promptId: string
    title: string
    draftText: string
    copyText?: string
    modifiedAt?: string | null
    onTitleChange?: (value: string) => void
    fallbackTitle?: string
    rowId?: string
    scrollToWithinWindowBand?: ScrollToWithinWindowBand
    onDelete?: () => void
    onTemplateSelect?: () => void
    onTemplateSelectAndCopy?: () => void
    onCopySuccess?: () => void | Promise<void>
    onStatusChange?: (status: import('@shared/Prompt').PromptStatus) => void
    onSelectionChange?: (startOffset: number, endOffset: number) => void
    onTitleEditorFocus?: () => void | Promise<void>
    inputRef?: HTMLInputElement | null
    metadataFolderLabel?: string | null
    metadataFolderState?: 'not-selected' | 'no-template' | 'selected'
    tokenCount: number
    icon?: ComponentType
    copyLabel?: string
    copyTitle?: string
    deleteLabel?: string
    deleteDialogTitle?: string
    deleteDialogDescription?: string
    completedAt?: string | null
    status?: import('@shared/Prompt').PromptStatus
    isEdited?: boolean
    compactLayout?: boolean
  }
</script>

<script lang="ts">
  import { onMount } from 'svelte'
  import ConfirmationDialog from '@renderer/common/cthulhu-ui/ConfirmationDialog.svelte'
  import IconCell from '@renderer/common/cthulhu-ui/IconCell.svelte'
  import IconButton from '@renderer/common/cthulhu-ui/IconButton.svelte'
  import Separator from '@renderer/common/cthulhu-ui/Separator.svelte'
  import SeparatorDot from '@renderer/common/cthulhu-ui/SeparatorDot.svelte'
  import PromptEditorButtonBar from './PromptEditorButtonBar.svelte'
  import PromptEditorStatusControl from './PromptEditorStatusControl.svelte'
  import { FileText, Layers, Trash2 } from 'lucide-svelte'
  import { PromptStatus } from '@shared/Prompt'
  import { formatPromptModifiedFull, formatPromptModifiedRelative } from './promptModifiedTime'
  import { getPromptNavigationContext } from '@renderer/app/PromptNavigationContext.svelte.ts'

  let {
    promptId,
    title,
    draftText,
    copyText,
    modifiedAt = null,
    onTitleChange,
    fallbackTitle = '',
    rowId,
    scrollToWithinWindowBand,
    onDelete,
    onTemplateSelect,
    onTemplateSelectAndCopy,
    onCopySuccess,
    onStatusChange,
    onSelectionChange,
    onTitleEditorFocus,
    inputRef = $bindable(null),
    metadataFolderLabel = 'Template',
    metadataFolderState = 'not-selected',
    tokenCount,
    icon = FileText,
    copyLabel,
    copyTitle,
    deleteLabel = 'Delete prompt',
    deleteDialogTitle = 'Delete Prompt',
    deleteDialogDescription = 'Are you sure you want to delete this prompt?',
    completedAt = null,
    status = PromptStatus.Todo,
    isEdited = false,
    compactLayout = false
  }: PromptEditorTitleRowProps = $props()

  /** Shared navigation state identifies direct tree clicks that should replay this title accent. */
  const promptNavigation = getPromptNavigationContext()
  /** Matching click generation remounts the indicator and restarts its CSS animation. */
  const navigationHighlightGeneration = $derived(
    promptNavigation.navigationHighlight?.promptId === promptId
      ? promptNavigation.navigationHighlight.generation
      : null
  )

  // Delete dialog state keeps confirmation behavior with the isolated delete section.
  let isDeleteDialogOpen = $state(false)
  // Derived placeholder text shows the fallback title when the title is empty.
  const titlePlaceholder = $derived.by(() =>
    title.trim().length === 0 ? `${fallbackTitle}...` : 'Title...'
  )
  const tokenCountLabel = $derived(`${tokenCount} ${tokenCount === 1 ? 'token' : 'tokens'}`)
  let nowMs = $state(Date.now())
  const modifiedRelativeLabel = $derived(
    modifiedAt ? formatPromptModifiedRelative(modifiedAt, nowMs) : ''
  )
  const modifiedUpdatedLabel = $derived(
    modifiedRelativeLabel ? `Updated ${modifiedRelativeLabel}` : ''
  )
  const modifiedFullLabel = $derived(modifiedAt ? formatPromptModifiedFull(modifiedAt) : '')
  const completedRelativeLabel = $derived(
    completedAt ? formatPromptModifiedRelative(completedAt, nowMs) : ''
  )
  const completedLabel = $derived(
    completedRelativeLabel ? `Completed ${completedRelativeLabel}` : ''
  )
  const completedFullLabel = $derived(completedAt ? formatPromptModifiedFull(completedAt) : '')
  // Side effect: keep the relative modified label fresh while the prompt folder stays open.
  onMount(() => {
    const intervalId = window.setInterval(() => {
      nowMs = Date.now()
    }, 60_000)

    return () => {
      window.clearInterval(intervalId)
    }
  })

  const handleTitleInput = (event: Event) => {
    const input = event.currentTarget as HTMLInputElement
    if (!onTitleChange) return
    onTitleChange(input.value)

    if (!scrollToWithinWindowBand || !rowId) return
    const rowElement = input.closest('[data-virtual-window-row]') as HTMLElement | null
    if (!rowElement) return

    const inputRect = input.getBoundingClientRect()
    const rowRect = rowElement.getBoundingClientRect()
    const centerOffsetPx = inputRect.top - rowRect.top + inputRect.height / 2
    scrollToWithinWindowBand(rowId, centerOffsetPx, 'minimal')
  }

  const handleTitleFocus = (event: FocusEvent) => {
    const input = event.currentTarget as HTMLInputElement
    input.focus({ preventScroll: true })
  }

  const handleSelectionChange = (event: Event) => {
    const input = event.currentTarget as HTMLInputElement
    const startOffset = input.selectionStart ?? input.value.length
    const endOffset = input.selectionEnd ?? startOffset
    onSelectionChange?.(startOffset, endOffset)
  }

  const handleTitleKeydown = (event: KeyboardEvent) => {
    const isForwardTab = event.key === 'Tab' && !event.shiftKey
    const isPlainEnter =
      event.key === 'Enter' &&
      !event.shiftKey &&
      !event.ctrlKey &&
      !event.altKey &&
      !event.metaKey
    if (!isForwardTab && !isPlainEnter) return
    if (!onTitleEditorFocus) return
    event.preventDefault()
    void onTitleEditorFocus()
  }

  const handleCopySuccess = async () => {
    await onCopySuccess?.()
    if (status === PromptStatus.Completed || status === PromptStatus.InProgress) return
    await onStatusChange?.(PromptStatus.InProgress)
  }

  // The delete action immediately removes blank prompts and confirms deletion for nonblank prompts.
  const handleDeleteClick = () => {
    if (!onDelete) return
    const hasContent = title.trim().length > 0 || draftText.trim().length > 0
    if (hasContent) {
      isDeleteDialogOpen = true
      return
    }

    onDelete()
  }

  // Confirming closes the dialog before deleting the prompt.
  const handleConfirmDelete = () => {
    if (!onDelete) return
    isDeleteDialogOpen = false
    onDelete()
  }

  // Cancelling closes the delete dialog without changing the prompt.
  const handleCancelDelete = () => {
    isDeleteDialogOpen = false
  }
</script>

<div class="prompt-editor-title-row" data-layout={compactLayout ? 'compact' : 'default'}>
  <!-- Reserve the indicator column so Todo titles stay aligned with other statuses. -->
  {#key navigationHighlightGeneration}
    <span
      class="prompt-editor-title-status-indicator"
      data-status={status}
      data-edited={isEdited ? 'true' : 'false'}
      data-navigation-highlight={navigationHighlightGeneration === null ? undefined : 'true'}
      data-navigation-highlight-generation={navigationHighlightGeneration ?? undefined}
      data-testid="prompt-title-status-indicator"
      aria-hidden="true"
    ></span>
  {/key}

  <div class="prompt-editor-title-main">
    <IconCell {icon} size="title" />

    <div class="prompt-editor-title-copy">
      {#if onTitleChange}
        <input
          data-testid="prompt-title"
          placeholder={titlePlaceholder}
          value={title}
          bind:this={inputRef}
          oninput={(event) => {
            handleTitleInput(event)
            handleSelectionChange(event)
          }}
          onfocus={handleTitleFocus}
          onkeydown={handleTitleKeydown}
          onkeyup={handleSelectionChange}
          onmouseup={handleSelectionChange}
          onselect={handleSelectionChange}
          class="prompt-editor-title-input"
        />
      {:else}
        <p class="prompt-editor-title-text">{title}</p>
      {/if}

      <div class="prompt-editor-metadata-row">
        {#if metadataFolderLabel}
          <span
            class="prompt-editor-metadata-folder"
            data-template-state={metadataFolderState}
            title={metadataFolderLabel}
          >
            <Layers class="prompt-editor-metadata-folder-icon h-3 w-3 shrink-0" />
            {metadataFolderLabel}
          </span>
        {/if}
        {#if metadataFolderLabel && modifiedAt}
          <SeparatorDot />
        {/if}
        {#if modifiedAt}
          <span data-testid="prompt-modified-time" title={modifiedFullLabel}>
            {modifiedUpdatedLabel}
          </span>
        {/if}
        {#if metadataFolderLabel || modifiedAt}
          <SeparatorDot />
        {/if}
        <span data-testid="prompt-token-count">{tokenCountLabel}</span>
        {#if completedAt}
          <SeparatorDot />
          <span data-testid="prompt-completed-time" title={completedFullLabel}>
            {completedLabel}
          </span>
        {/if}
      </div>
    </div>
  </div>

  <div class="prompt-editor-title-actions">
    <div class="prompt-editor-title-button-bar">
      <PromptEditorButtonBar
        {draftText}
        {copyText}
        {onTemplateSelect}
        {onTemplateSelectAndCopy}
        templateSelectionState={metadataFolderState}
        {copyLabel}
        {copyTitle}
        onCopySuccess={handleCopySuccess}
      />
    </div>

    {#if onStatusChange}
      <Separator orientation="vertical" class="prompt-editor-title-actions-separator" />
      <PromptEditorStatusControl {status} {onStatusChange} />
    {/if}

    {#if onDelete}
      <Separator orientation="vertical" class="prompt-editor-title-actions-separator" />
      <div class="prompt-editor-title-delete-section">
        <IconButton
          icon={Trash2}
          label={deleteLabel}
          title={deleteLabel}
          hoverVariant="danger"
          testId="prompt-delete-button"
          onclick={handleDeleteClick}
        />
      </div>
    {/if}
  </div>
</div>

{#if onDelete}
  <ConfirmationDialog
    bind:open={isDeleteDialogOpen}
    title={deleteDialogTitle}
    description={deleteDialogDescription}
    confirmText="Delete"
    confirmTestId="prompt-confirm-delete-button"
    oncancel={handleCancelDelete}
    onconfirm={handleConfirmDelete}
  />
{/if}

<style>
  .prompt-editor-title-row {
    align-items: center;
    background: transparent;
    border: 0;
    border-radius: 0;
    display: grid;
    gap: 0;
    grid-template-columns: 2px minmax(0, 1fr) auto;
    height: 100%;
    min-width: 0;
  }

  .prompt-editor-title-row[data-layout='compact'] {
    grid-template-columns: 2px minmax(0, 1fr);
    grid-template-rows: 56px 53px;
  }

  .prompt-editor-title-status-indicator {
    --prompt-status-indicator-color: transparent;
    align-self: stretch;
    background: var(--prompt-status-indicator-color);
    visibility: hidden;
  }

  .prompt-editor-title-row[data-layout='compact'] .prompt-editor-title-status-indicator {
    grid-row: 1 / -1;
  }

  .prompt-editor-title-status-indicator[data-edited='true'] {
    --prompt-status-indicator-color: var(--ui-info-strong-border);
    visibility: visible;
  }

  .prompt-editor-title-status-indicator[data-status='InProgress'] {
    --prompt-status-indicator-color: var(--ui-warning-icon-glyph);
    visibility: visible;
  }

  .prompt-editor-title-status-indicator[data-status='Completed'] {
    --prompt-status-indicator-color: var(--ui-success-normal-text);
    visibility: visible;
  }

  .prompt-editor-title-status-indicator[data-navigation-highlight='true'] {
    animation: prompt-editor-navigation-highlight 740ms linear;
  }

  @keyframes prompt-editor-navigation-highlight {
    0% {
      background: var(--prompt-status-indicator-color);
      visibility: visible;
    }
    16.2162%,
    83.7838% {
      background: var(--ui-accent-strong-border);
      visibility: visible;
    }
    100% {
      background: var(--prompt-status-indicator-color);
      visibility: visible;
    }
  }

  .prompt-editor-title-main {
    align-items: center;
    display: grid;
    gap: 8px;
    grid-template-columns: 40px minmax(0, 1fr);
    min-width: 0;
    padding: 8px;
  }

  .prompt-editor-title-row[data-layout='compact'] .prompt-editor-title-main {
    grid-column: 2;
    grid-row: 1;
  }

  .prompt-editor-title-actions {
    align-items: center;
    align-self: stretch;
    box-sizing: border-box;
    display: flex;
    gap: 12px;
    min-width: 0;
    padding-right: 12px;
  }

  .prompt-editor-title-row[data-layout='compact'] .prompt-editor-title-actions {
    border-top: 1px solid var(--ui-neutral-normal-border);
    box-sizing: border-box;
    grid-column: 2;
    grid-row: 2;
    justify-content: space-between;
    padding-left: 16px;
  }

  .prompt-editor-title-button-bar {
    align-items: center;
    display: flex;
    min-width: 0;
  }

  .prompt-editor-title-delete-section {
    align-items: center;
    display: flex;
    flex: 0 0 auto;
  }

  :global(.prompt-editor-title-actions-separator.cthulhuUiSeparator) {
    --cthulhu-ui-separator-color: var(--ui-neutral-normal-border);
    align-self: stretch;
    flex: 0 0 1px;
    height: auto;
  }

  .prompt-editor-title-row[data-layout='compact']
    :global(.prompt-editor-title-actions-separator.cthulhuUiSeparator) {
    display: none;
  }

  .prompt-editor-title-copy {
    display: grid;
    gap: 4px;
    min-width: 0;
  }

  .prompt-editor-title-input,
  .prompt-editor-title-text {
    background: transparent;
    border: 0;
    color: var(--ui-normal-text);
    font-family: inherit;
    font-size: 15px;
    font-weight: 600;
    height: 20px;
    line-height: 20px;
    min-width: 0;
    outline: none;
    padding: 0;
    width: 100%;
  }

  .prompt-editor-title-text {
    margin: 0;
  }

  .prompt-editor-title-input::placeholder {
    color: var(--ui-secondary-text);
  }

  .prompt-editor-metadata-row {
    align-items: center;
    color: var(--ui-muted-text);
    display: flex;
    flex-wrap: nowrap;
    font-size: 12px;
    gap: 8px;
    line-height: 16px;
    min-width: 0;
    overflow: hidden;
    white-space: nowrap;
  }

  .prompt-editor-metadata-folder {
    align-items: center;
    display: inline-flex;
    gap: 4px;
  }

  .prompt-editor-metadata-folder[data-template-state='not-selected'] {
    color: var(--ui-secondary-text);
  }

  .prompt-editor-metadata-folder[data-template-state='no-template'] {
    color: var(--ui-muted-text);
  }

  .prompt-editor-metadata-folder[data-template-state='selected'] {
    color: var(--ui-normal-text);
  }

</style>
