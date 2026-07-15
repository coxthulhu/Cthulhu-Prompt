<script module lang="ts">
  import type { ComponentType } from 'svelte'
  import type { ScrollToWithinWindowBand } from '../virtualizer/virtualWindowTypes'

  export type PromptEditorTitleRowProps = {
    title: string
    draftText: string
    copyText?: string
    modifiedAt?: string | null
    onTitleChange?: (value: string) => void
    fallbackTitle?: string
    rowId?: string
    scrollToWithinWindowBand?: ScrollToWithinWindowBand
    onDelete?: () => void
    onStatusChange?: (status: import('@shared/Prompt').PromptStatus) => void
    onSelectionChange?: (startOffset: number, endOffset: number) => void
    onTitleForwardTab?: () => void | Promise<void>
    inputRef?: HTMLInputElement | null
    metadataFolderLabel?: string
    lineCount: number
    tokenCount: number
    icon?: ComponentType
    copyLabel?: string
    copyTitle?: string
    completedAt?: string | null
    status?: import('@shared/Prompt').PromptStatus
  }
</script>

<script lang="ts">
  import { onMount } from 'svelte'
  import IconCell from '@renderer/common/cthulhu-ui/IconCell.svelte'
  import IconButtonWithMoreOptions from '@renderer/common/cthulhu-ui/IconButtonWithMoreOptions.svelte'
  import SeparatorDot from '@renderer/common/cthulhu-ui/SeparatorDot.svelte'
  import ValuePill from '@renderer/common/cthulhu-ui/ValuePill.svelte'
  import type { DropdownPopupDetailedItem } from '@renderer/common/cthulhu-ui/DropdownPopupDetailed.svelte'
  import PromptEditorButtonBar from './PromptEditorButtonBar.svelte'
  import {
    Check,
    CheckCircle2,
    CircleDashed,
    FileText,
    Folder,
    Hourglass,
    Undo2
  } from 'lucide-svelte'
  import { PromptStatus } from '@shared/Prompt'
  import { formatPromptModifiedFull, formatPromptModifiedRelative } from './promptModifiedTime'

  let {
    title,
    draftText,
    copyText,
    modifiedAt = null,
    onTitleChange,
    fallbackTitle = '',
    rowId,
    scrollToWithinWindowBand,
    onDelete,
    onStatusChange,
    onSelectionChange,
    onTitleForwardTab,
    inputRef = $bindable(null),
    metadataFolderLabel = 'Prompts',
    lineCount,
    tokenCount,
    icon = FileText,
    copyLabel,
    copyTitle,
    completedAt = null,
    status = PromptStatus.Todo
  }: PromptEditorTitleRowProps = $props()

  // Derived placeholder text shows the fallback title when the title is empty.
  const titlePlaceholder = $derived.by(() =>
    title.trim().length === 0 ? `${fallbackTitle}...` : 'Title...'
  )
  const lineCountLabel = $derived(`${lineCount} ${lineCount === 1 ? 'line' : 'lines'}`)
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
  const isCompleted = $derived(status === PromptStatus.Completed)
  const statusDetails = $derived.by(() => {
    if (status === PromptStatus.Completed) {
      return { label: 'Completed', icon: CheckCircle2, variant: 'completed' as const }
    }
    if (status === PromptStatus.InProgress) {
      return { label: 'In Progress', icon: Hourglass, variant: 'in-progress' as const }
    }
    return { label: 'Todo', icon: CircleDashed, variant: 'todo' as const }
  })
  const statusOptions = $derived.by<DropdownPopupDetailedItem[]>(() =>
    [
      {
        id: PromptStatus.Todo,
        label: 'Set to Todo',
        detail: 'Move back to active todo status',
        icon: CircleDashed,
        iconClass: 'prompt-editor-status-option-icon-todo',
        testId: 'prompt-status-option-todo'
      },
      {
        id: PromptStatus.InProgress,
        label: 'In Progress',
        detail: 'Mark this prompt as underway',
        icon: Hourglass,
        iconClass: 'prompt-editor-status-option-icon-in-progress',
        testId: 'prompt-status-option-in-progress'
      },
      {
        id: PromptStatus.Completed,
        label: 'Complete',
        detail: 'Move this prompt to completed',
        icon: CheckCircle2,
        iconClass: 'prompt-editor-status-option-icon-completed',
        testId: 'prompt-status-option-completed'
      }
    ].filter((item) => item.id !== status)
  )
  const defaultStatusAction = $derived.by(() =>
    isCompleted
      ? {
          icon: Undo2,
          label: 'Uncomplete prompt',
          title: 'Uncomplete prompt',
          hoverVariant: 'accent' as const,
          testId: 'prompt-uncomplete-button',
          status: PromptStatus.Todo
        }
      : {
          icon: Check,
          label: 'Complete prompt',
          title: 'Complete prompt',
          hoverVariant: 'success' as const,
          testId: 'prompt-complete-button',
          status: PromptStatus.Completed
        }
  )

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
    if (event.key !== 'Tab' || event.shiftKey) return
    if (!onTitleForwardTab) return
    event.preventDefault()
    void onTitleForwardTab()
  }

  const handleStatusSelect = (item: DropdownPopupDetailedItem) => {
    onStatusChange?.(item.id as PromptStatus)
  }

  const handleCopySuccess = async () => {
    if (status === PromptStatus.Completed || status === PromptStatus.InProgress) return
    await onStatusChange?.(PromptStatus.InProgress)
  }
</script>

<div class="prompt-editor-title-row">
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
        <span class="prompt-editor-metadata-folder" title={metadataFolderLabel}>
          <Folder class="prompt-editor-metadata-folder-icon h-3 w-3 shrink-0" />
          {metadataFolderLabel}
        </span>
        <SeparatorDot />
        <span data-testid="prompt-line-count">{lineCountLabel}</span>
        <SeparatorDot />
        <span data-testid="prompt-token-count">{tokenCountLabel}</span>
        {#if modifiedAt}
          <SeparatorDot />
          <span data-testid="prompt-modified-time" title={modifiedFullLabel}>
            {modifiedUpdatedLabel}
          </span>
        {/if}
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
        {title}
        {draftText}
        {copyText}
        {onDelete}
        {copyLabel}
        {copyTitle}
        onCopySuccess={handleCopySuccess}
      />
    </div>

    <span class="prompt-editor-title-actions-separator" aria-hidden="true"></span>

    <div class="prompt-editor-status-control">
      {#if onStatusChange}
        <IconButtonWithMoreOptions
          icon={defaultStatusAction.icon}
          label={defaultStatusAction.label}
          title={defaultStatusAction.title}
          mainHoverVariant={defaultStatusAction.hoverVariant}
          moreOptionsHoverVariant="neutral"
          testId={defaultStatusAction.testId}
          moreOptionsTestId="prompt-status-more-options-button"
          menuTestId="prompt-status-more-options-menu"
          moreOptions={statusOptions}
          onclick={() => onStatusChange?.(defaultStatusAction.status)}
          onselect={handleStatusSelect}
        />
      {/if}

      <ValuePill
        text={statusDetails.label}
        variant={statusDetails.variant}
        icon={statusDetails.icon}
        testId="prompt-status-pill"
      />
    </div>
  </div>
</div>

<style>
  .prompt-editor-title-row {
    align-items: center;
    background: transparent;
    border: 0;
    border-radius: 0;
    display: grid;
    gap: 0;
    grid-template-columns: minmax(0, 1fr) auto;
    height: 100%;
    min-width: 0;
  }

  .prompt-editor-title-main {
    align-items: center;
    display: grid;
    gap: 8px;
    grid-template-columns: 40px minmax(0, 1fr);
    min-width: 0;
    padding: 8px 8px 8px 16px;
  }

  .prompt-editor-title-actions {
    align-items: center;
    align-self: stretch;
    display: flex;
    gap: 12px;
    min-width: 0;
  }

  .prompt-editor-title-button-bar {
    align-items: center;
    display: flex;
    min-width: 0;
  }

  .prompt-editor-title-actions-separator {
    align-self: stretch;
    background: var(--ui-neutral-normal-border);
    flex: 0 0 1px;
    width: 1px;
  }

  .prompt-editor-status-control {
    align-items: center;
    display: inline-flex;
    flex: 0 0 auto;
    gap: 12px;
    padding-left: 4px;
    padding-right: 16px;
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
    height: 22px;
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
    color: var(--ui-secondary-text);
    display: inline-flex;
    flex: 0 1 auto;
    gap: 4px;
    max-width: 220px;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  :global(.prompt-editor-metadata-folder-icon) {
    color: var(--ui-secondary-icon-glyph);
  }

  :global(.prompt-editor-status-option-icon-todo) {
    color: var(--ui-secondary-icon-glyph);
  }

  :global(.prompt-editor-status-option-icon-in-progress) {
    color: var(--ui-warning-icon-glyph);
  }

  :global(.prompt-editor-status-option-icon-completed) {
    color: var(--ui-success-normal-text);
  }
</style>
