<script lang="ts">
  import AccentIconTile from '@renderer/common/cthulhu-ui/AccentIconTile.svelte'
  import PromptEditorButtonBar from './PromptEditorButtonBar.svelte'
  import type { ScrollToWithinWindowBand } from '../virtualizer/virtualWindowTypes'
  import type { ComponentType } from 'svelte'
  import { FileText, Folder } from 'lucide-svelte'

  type Props = {
    title: string
    draftText: string
    onTitleChange?: (value: string) => void
    promptFolderCount?: number
    rowId?: string
    scrollToWithinWindowBand?: ScrollToWithinWindowBand
    onDelete?: () => void
    onSelectionChange?: (startOffset: number, endOffset: number) => void
    inputRef?: HTMLInputElement | null
    metadataFolderLabel?: string
    icon?: ComponentType
    copyLabel?: string
    copyTitle?: string
  }

  let {
    title,
    draftText,
    onTitleChange,
    promptFolderCount = 0,
    rowId,
    scrollToWithinWindowBand,
    onDelete,
    onSelectionChange,
    inputRef = $bindable(null),
    metadataFolderLabel = 'Prompts',
    icon = FileText,
    copyLabel,
    copyTitle
  }: Props = $props()

  // Derived placeholder text shows the prompt count when the title is empty.
  const titlePlaceholder = $derived.by(() =>
    title.trim().length === 0 ? `Title (Prompt ${promptFolderCount})` : 'Title'
  )

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
</script>

<div class="prompt-editor-title-bar">
  <div class="prompt-editor-title-main">
    <AccentIconTile {icon} size="small" variant="accent-bordered" />

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
        <span>0 lines</span>
        <span class="prompt-editor-metadata-dot"></span>
        <span>0 tokens</span>
        <span class="prompt-editor-metadata-dot"></span>
        <span>0 min ago</span>
      </div>
    </div>
  </div>

  <PromptEditorButtonBar {title} {draftText} {onDelete} {copyLabel} {copyTitle} />
</div>

<style>
  .prompt-editor-title-bar {
    align-items: center;
    background: var(--ui-neutral-muted-surface);
    border: 1px solid var(--ui-card-nested-border);
    border-radius: 7px;
    box-shadow: inset 0 1px 0 var(--ui-card-nested-inset-highlight);
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
    font-weight: 700;
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
