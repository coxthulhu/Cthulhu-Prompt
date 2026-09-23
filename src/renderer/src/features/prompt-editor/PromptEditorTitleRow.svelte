<script module lang="ts">
  import type { ComponentType } from 'svelte'
  import type { ScrollToWithinWindowBand } from '@renderer/common/virtual-window/virtualWindowTypes'
  import type { PromptFolderFindRequest } from '../prompt-folders/find/promptFolderFindTypes'

  export type PromptEditorTitleRowProps = {
    /** Folder search state used to decorate title occurrences without taking focus. */
    findRequest?: PromptFolderFindRequest | null
    title: string
    draftText: string
    copyText?: string
    modifiedAt?: string | null
    onTitleChange?: (value: string) => void
    fallbackTitle?: string
    rowId?: string
    scrollToWithinWindowBand?: ScrollToWithinWindowBand
    onDelete?: () => void
    /** Archives a prompt through the shared final-status mutation. */
    onArchive?: () => void
    /** Restores an archived template to the top of Active. */
    onRestore?: () => void
    onTemplateSelect?: () => void
    onTemplateSelectAndCopy?: () => void
    onCopySuccess?: () => void | Promise<void>
    onStatusChange?: (status: import('@shared/domain/prompt/Prompt').PromptStatus) => void
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
    finalizedAt?: string | null
    status?: import('@shared/domain/prompt/Prompt').PromptContentStatus
    isEdited?: boolean
    compactLayout?: boolean
  }
</script>

<script lang="ts">
  import { onMount } from 'svelte'
  import ConfirmationDialog from '@renderer/common/cthulhu-ui/dialogs/ConfirmationDialog.svelte'
  import IconCell from '@renderer/common/cthulhu-ui/layout/IconCell.svelte'
  import IconButton from '@renderer/common/cthulhu-ui/buttons/IconButton.svelte'
  import IconButtonBar from '@renderer/common/cthulhu-ui/buttons/IconButtonBar.svelte'
  import IconButtonWithMoreOptions from '@renderer/common/cthulhu-ui/buttons/IconButtonWithMoreOptions.svelte'
  import type { DropdownPopupDetailedItem } from '@renderer/common/cthulhu-ui/dropdowns/DropdownPopupDetailed.svelte'
  import Separator from '@renderer/common/cthulhu-ui/layout/Separator.svelte'
  import SeparatorDot from '@renderer/common/cthulhu-ui/layout/SeparatorDot.svelte'
  import PromptEditorButtonBar from './PromptEditorButtonBar.svelte'
  import PromptEditorStatusControl from './PromptEditorStatusControl.svelte'
  import { Archive, FileText, Layers, Trash2, Undo2 } from 'lucide-svelte'
  import { isPromptStatus, PROMPT_STATUS_BEHAVIORS, PromptStatus } from '@shared/domain/prompt/Prompt'
  import { formatPromptModifiedFull, formatPromptModifiedRelative } from './promptModifiedTime'
  import { getPromptFolderFindContext } from '../prompt-folders/find/promptFolderFindContext'
  import { PROMPT_FOLDER_FIND_TITLE_SECTION_KEY } from '../prompt-folders/find/promptFolderFindSectionKeys'

  let {
    findRequest,
    title,
    draftText,
    copyText,
    modifiedAt = null,
    onTitleChange,
    fallbackTitle = '',
    rowId,
    scrollToWithinWindowBand,
    onDelete,
    onArchive,
    onRestore,
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
    deleteDialogDescription = 'Are you sure you want to permanently delete this prompt?',
    finalizedAt = null,
    status = PromptStatus.Todo,
    isEdited = false,
    compactLayout = false
  }: PromptEditorTitleRowProps = $props()

  /** Shared Monaco search implementation keeps title decoration ranges consistent with counts. */
  const findContext = getPromptFolderFindContext()
  /** Invisible text mirror whose backgrounds show through the native input. */
  let titleMirror = $state<HTMLDivElement | null>(null)
  /** Horizontal input offset applied to the highlight mirror. */
  let titleScrollLeft = $state(0)
  /** Available title width; resizing also reveals the current match again. */
  let titleWidth = $state(0)
  /** Literal, case-insensitive occurrences while the find dialog is open. */
  const titleMatches = $derived(
    findRequest?.isOpen && findRequest.query
      ? (findContext?.findMatchesInText(title, findRequest.query) ?? [])
      : []
  )
  /** Only explicit find navigation decorates a current match, matching Monaco's passive opening. */
  const currentTitleMatchIndex = $derived(
    findRequest?.shouldSelectActiveMatch &&
      findRequest.activeSectionKey === PROMPT_FOLDER_FIND_TITLE_SECTION_KEY
      ? findRequest.activeSectionMatchIndex
      : null
  )

  /** Keep match backgrounds aligned when the native input scrolls during editing. */
  const syncTitleScroll = () => {
    titleScrollLeft = inputRef?.scrollLeft ?? 0
  }

  // Side effect: reveal a navigated title occurrence horizontally without changing focus or selection.
  $effect(() => {
    if (!titleWidth || !titleMatches.length || !inputRef || !titleMirror || currentTitleMatchIndex == null) return
    /** Current occurrence's geometry in the unscrolled mirror. */
    const match = titleMirror.querySelector<HTMLElement>('[data-current="true"]')
    if (!match) return
    /** Pixel bounds measured from the same font and text as the native input. */
    const start = match.offsetLeft
    const end = start + match.offsetWidth
    if (start < inputRef.scrollLeft) {
      inputRef.scrollLeft = start
    } else if (end > inputRef.scrollLeft + inputRef.clientWidth) {
      inputRef.scrollLeft = Math.min(start, end - inputRef.clientWidth)
    }
    syncTitleScroll()
  })

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
  /** Relative timestamp shared by Completed and Archived metadata. */
  const finalizedRelativeLabel = $derived(
    finalizedAt ? formatPromptModifiedRelative(finalizedAt, nowMs) : ''
  )
  /** Status-aware label for the prompt's current finalization time. */
  const finalizedLabel = $derived(
    finalizedRelativeLabel ? `${status} ${finalizedRelativeLabel}` : ''
  )
  /** Full finalization timestamp exposed as metadata hover text. */
  const finalizedFullLabel = $derived(finalizedAt ? formatPromptModifiedFull(finalizedAt) : '')
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
    handleSelectionChange(event)
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
    /** Optional workflow transition configured for successful copying. */
    const nextStatus = isPromptStatus(status) ? PROMPT_STATUS_BEHAVIORS[status].copyStatus : undefined
    if (nextStatus) await onStatusChange?.(nextStatus)
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

  /** Whether the split button's primary action archives this nonblank prompt. */
  const isArchiveDefaultAction = $derived(
    onArchive !== undefined &&
      status !== PromptStatus.Archived &&
      (title.trim().length > 0 || draftText.trim().length > 0)
  )
  /** Main split-button icon matching its current default action. */
  const DeletePrimaryIcon = $derived(isArchiveDefaultAction ? Archive : Trash2)
  /** Accessible main split-button label matching its current default action. */
  const deletePrimaryLabel = $derived(isArchiveDefaultAction ? deleteLabel.replace('Delete', 'Archive') : deleteLabel)
  /** Alternate action offered by the prompt delete split button. */
  const deleteMoreOptions = $derived.by<DropdownPopupDetailedItem[]>(() => [
    isArchiveDefaultAction
      ? {
          id: 'delete',
          label: deleteDialogTitle,
          detail: `Permanently ${deleteLabel.toLowerCase()}`,
          icon: Trash2,
          testId: 'prompt-delete-menu-item'
        }
      : {
          id: 'archive',
          label: deleteDialogTitle.replace('Delete', 'Archive'),
          detail: 'Move to Archived',
          icon: Archive,
          testId: 'prompt-archive-menu-item'
        }
  ])

  /** Runs the split button's context-sensitive primary action. */
  const handleDeletePrimaryClick = () => {
    if (isArchiveDefaultAction) {
      onArchive?.()
      return
    }
    handleDeleteClick()
  }

  /** Runs the split button action selected from its one-item dropdown. */
  const handleDeleteMoreOptionsSelect = (item: DropdownPopupDetailedItem) => {
    if (item.id === 'archive') {
      onArchive?.()
      return
    }
    handleDeleteClick()
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
  <span
    class="prompt-editor-title-status-indicator"
    data-status={status}
    data-edited={isEdited ? 'true' : 'false'}
    data-testid="prompt-title-status-indicator"
    aria-hidden="true"
  ></span>

  <div class="prompt-editor-title-main">
    <IconCell {icon} variant="title" />

    <div class="prompt-editor-title-copy">
      {#if onTitleChange}
        <div class="prompt-editor-title-field" bind:clientWidth={titleWidth}>
          <div class="prompt-editor-title-highlights text-sm leading-5" aria-hidden="true">
            <div
              class="prompt-editor-title-mirror"
              bind:this={titleMirror}
              style:transform={`translateX(${-titleScrollLeft}px)`}
            >
              {#each titleMatches as match, index (match.startOffset)}
                {title.slice(index === 0 ? 0 : titleMatches[index - 1].endOffset, match.startOffset)}<span
                  class="prompt-editor-title-match"
                  data-testid="prompt-title-find-match"
                  data-current={index === currentTitleMatchIndex}
                >{title.slice(match.startOffset, match.endOffset)}</span>
              {/each}{title.slice(titleMatches.at(-1)?.endOffset ?? 0)}
            </div>
          </div>
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
            onscroll={syncTitleScroll}
            class="prompt-editor-title-input text-sm leading-5"
          />
        </div>
      {:else}
        <p class="prompt-editor-title-text text-sm">{title}</p>
      {/if}

      <div class="prompt-editor-metadata-row text-xs">
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
        {#if finalizedAt}
          <SeparatorDot />
          <span data-testid="prompt-finalized-time" title={finalizedFullLabel}>
            {finalizedLabel}
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
        showCopyActions={status !== PromptStatus.Backlog}
      />
    </div>

    {#if onStatusChange && isPromptStatus(status)}
      <Separator orientation="vertical" class="prompt-editor-title-actions-separator" />
      <PromptEditorStatusControl {status} {onStatusChange} />
    {/if}

    {#if onDelete}
      <Separator orientation="vertical" class="prompt-editor-title-actions-separator" />
      <IconButtonBar class="prompt-editor-title-delete-section">
        {#if onRestore}
          <IconButton
            icon={Undo2}
            label="Restore to Active"
            title="Restore to Active"
            testId="template-restore-button"
            onclick={onRestore}
          />
        {/if}
        {#if onArchive && status !== PromptStatus.Archived}
          <IconButtonWithMoreOptions
            icon={DeletePrimaryIcon}
            label={deletePrimaryLabel}
            title={deletePrimaryLabel}
            moreOptions={deleteMoreOptions}
            mainHoverVariant={isArchiveDefaultAction ? 'neutral' : 'danger'}
            moreOptionsHoverVariant="neutral"
            testId={isArchiveDefaultAction ? 'prompt-archive-button' : 'prompt-delete-button'}
            moreOptionsTestId="prompt-delete-more-options-button"
            menuTestId="prompt-delete-more-options-menu"
            menuWidth="240px"
            onclick={handleDeletePrimaryClick}
            onselect={handleDeleteMoreOptionsSelect}
          />
        {:else}
          <IconButton
            icon={Trash2}
            label={deleteLabel}
            title={deleteLabel}
            hoverVariant="danger"
            testId="prompt-delete-button"
            onclick={handleDeleteClick}
          />
        {/if}
      </IconButtonBar>
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

  .prompt-editor-title-status-indicator[data-status='Archived'] {
    --prompt-status-indicator-color: var(--ui-secondary-icon-glyph);
    visibility: visible;
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
    font-weight: var(--font-weight-semibold);
    height: 20px;
    min-width: 0;
    outline: none;
    padding: 0;
    width: 100%;
  }

  .prompt-editor-title-field {
    position: relative;
    min-width: 0;
    height: 20px;
  }

  .prompt-editor-title-input {
    position: relative;
    display: block;
  }

  .prompt-editor-title-highlights {
    position: absolute;
    inset: 0;
    overflow: hidden;
    pointer-events: none;
    color: transparent;
    font-weight: var(--font-weight-semibold);
  }

  .prompt-editor-title-mirror {
    position: relative;
    width: max-content;
    white-space: pre;
  }

  .prompt-editor-title-match {
    background-color: var(--ui-search-match-fill);
    border: none;
  }

  .prompt-editor-title-match[data-current='true'] {
    background-color: var(--ui-search-current-fill);
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
    gap: 8px;
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
