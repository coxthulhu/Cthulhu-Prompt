<script lang="ts">
  import { onMount } from 'svelte'
  import AccentIconTile from '@renderer/common/cthulhu-ui/AccentIconTile.svelte'
  import PromptEditorButtonBar from './PromptEditorButtonBar.svelte'
  import type { ScrollToWithinWindowBand } from '../virtualizer/virtualWindowTypes'
  import type { ComponentType } from 'svelte'
  import { FileText, Folder } from 'lucide-svelte'
  import { formatPromptModifiedFull, formatPromptModifiedRelative } from './promptModifiedTime'

  type Props = {
    title: string
    draftText: string
    copyText?: string
    modifiedAt?: string | null
    onTitleChange?: (value: string) => void
    fallbackTitle?: string
    rowId?: string
    scrollToWithinWindowBand?: ScrollToWithinWindowBand
    onDelete?: () => void
    onSelectionChange?: (startOffset: number, endOffset: number) => void
    onTitleForwardTab?: () => void | Promise<void>
    inputRef?: HTMLInputElement | null
    metadataFolderLabel?: string
    lineCount: number
    tokenCount: number
    icon?: ComponentType
    copyLabel?: string
    copyTitle?: string
  }

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
    onSelectionChange,
    onTitleForwardTab,
    inputRef = $bindable(null),
    metadataFolderLabel = 'Prompts',
    lineCount,
    tokenCount,
    icon = FileText,
    copyLabel,
    copyTitle
  }: Props = $props()

  // Derived placeholder text shows the fallback title when the title is empty.
  const titlePlaceholder = $derived.by(() =>
    title.trim().length === 0 ? `Title (${fallbackTitle})` : 'Title'
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
</script>

<div class="prompt-editor-title-bar">
  <div class="prompt-editor-title-main">
    <AccentIconTile {icon} size="medium" variant="accent" />

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
          <Folder class="h-3 w-3 shrink-0 stroke-[2.4]" />
          {metadataFolderLabel}
        </span>
        <span class="prompt-editor-metadata-dot"></span>
        <span data-testid="prompt-line-count">{lineCountLabel}</span>
        <span class="prompt-editor-metadata-dot"></span>
        <span data-testid="prompt-token-count">{tokenCountLabel}</span>
        {#if modifiedAt}
          <span class="prompt-editor-metadata-dot"></span>
          <span data-testid="prompt-modified-time" title={modifiedFullLabel}>
            {modifiedUpdatedLabel}
          </span>
        {/if}
      </div>
    </div>
  </div>

  <PromptEditorButtonBar {title} {draftText} {copyText} {onDelete} {copyLabel} {copyTitle} />
</div>

<style>
  .prompt-editor-title-bar {
    align-items: center;
    background: var(--ui-neutral-muted-surface);
    border: 1px solid var(--ui-card-nested-border);
    border-radius: 7px;
    display: grid;
    gap: 12px;
    grid-template-columns: minmax(0, 1fr) auto;
    min-width: 0;
    padding: 8px 8px 8px 10px;
  }

  .prompt-editor-title-main {
    align-items: center;
    display: grid;
    gap: 10px;
    grid-template-columns: 40px minmax(0, 1fr);
    min-width: 0;
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
    font-size: 11px;
    font-weight: 750;
    gap: 7px;
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
    gap: 5px;
    max-width: 220px;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .prompt-editor-metadata-dot {
    background: var(--ui-neutral-emphasis-border);
    border-radius: 999px;
    flex: 0 0 auto;
    height: 3px;
    width: 3px;
  }
</style>
