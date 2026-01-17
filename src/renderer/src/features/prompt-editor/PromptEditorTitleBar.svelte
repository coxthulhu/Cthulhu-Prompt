<script lang="ts">
  import Input from '@renderer/common/ui/input/input.svelte'
  import PromptEditorButtonBar from './PromptEditorButtonBar.svelte'
  import type { ScrollToWithinWindowBand } from '../virtualizer/virtualWindowTypes'

  type Props = {
    title: string
    draftText: string
    onTitleChange: (value: string) => void
    rowId: string
    scrollToWithinWindowBand?: ScrollToWithinWindowBand
    onDelete: () => void
    inputRef?: HTMLInputElement | null
  }

  let {
    title,
    draftText,
    onTitleChange,
    rowId,
    scrollToWithinWindowBand,
    onDelete,
    inputRef = $bindable(null)
  }: Props = $props()

  const handleTitleInput = (event: Event) => {
    const input = event.currentTarget as HTMLInputElement
    onTitleChange(input.value)

    if (!scrollToWithinWindowBand) return
    const rowElement = input.closest('[data-prompt-editor-row]') as HTMLElement | null
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
</script>

<div class="flex items-center gap-2 py-0.5">
  <Input
    data-testid="prompt-title"
    placeholder="Title"
    value={title}
    bind:ref={inputRef}
    oninput={handleTitleInput}
    onfocus={handleTitleFocus}
    class="flex-1 h-[28px] font-mono text-[16px] leading-[20px] md:text-[16px] md:leading-[20px] text-[#D4D4D4] placeholder:text-[#D4D4D4]"
  />
  <PromptEditorButtonBar {title} {draftText} {onDelete} />
</div>
