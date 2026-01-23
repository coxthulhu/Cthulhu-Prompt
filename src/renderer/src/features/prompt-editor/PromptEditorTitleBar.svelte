<script lang="ts">
  import Input from '@renderer/common/ui/input/input.svelte'
  import PromptEditorButtonBar from './PromptEditorButtonBar.svelte'
  import type { ScrollToWithinWindowBand } from '../virtualizer/virtualWindowTypes'

  type Props = {
    title: string
    draftText: string
    onTitleChange: (value: string) => void
    promptFolderCount: number
    rowId: string
    scrollToWithinWindowBand?: ScrollToWithinWindowBand
    onDelete: () => void
    onSelectionChange?: (startOffset: number, endOffset: number) => void
    inputRef?: HTMLInputElement | null
  }

  let {
    title,
    draftText,
    onTitleChange,
    promptFolderCount,
    rowId,
    scrollToWithinWindowBand,
    onDelete,
    onSelectionChange,
    inputRef = $bindable(null)
  }: Props = $props()

  // Derived placeholder text shows the prompt count when the title is empty.
  const titlePlaceholder = $derived.by(() =>
    title.trim().length === 0 ? `Title (Prompt ${promptFolderCount})` : 'Title'
  )

  const handleTitleInput = (event: Event) => {
    const input = event.currentTarget as HTMLInputElement
    onTitleChange(input.value)

    if (!scrollToWithinWindowBand) return
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

<div class="flex items-center gap-2 py-0.5">
  <Input
    data-testid="prompt-title"
    placeholder={titlePlaceholder}
    value={title}
    bind:ref={inputRef}
    oninput={(event) => {
      handleTitleInput(event)
      handleSelectionChange(event)
    }}
    onfocus={handleTitleFocus}
    onkeyup={handleSelectionChange}
    onmouseup={handleSelectionChange}
    onselect={handleSelectionChange}
    class="flex-1 w-full h-[28px] font-mono text-[16px] leading-[20px] md:text-[16px] md:leading-[20px] text-[#D4D4D4] placeholder:text-[#D4D4D4]"
  />
  <PromptEditorButtonBar {title} {draftText} {onDelete} />
</div>
