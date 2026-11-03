<script lang="ts">
  import { startPointerDrag } from '@renderer/common/drag-drop/pointerDrag'
  import ResizeSash from '@renderer/common/cthulhu-ui/layout/ResizeSash.svelte'

  /** Shared horizontal sash laid over the top edge of the lower of two stacked editors. */
  let { label, testId, onResizeStart, onResize }: {
    /** Accessible name describing what the sash resizes. */
    label: string
    testId?: string
    /** Lets the owner snapshot its sizes when a drag begins. */
    onResizeStart: () => void
    /** Receives the pointer's vertical travel since the press. */
    onResize: (deltaPx: number) => void
  } = $props()

  /** Whether a drag is active, used to show the sash highlight. */
  let isDragging = $state(false)

  /** Captures one primary-button drag and reports travel relative to the press position. */
  const startResize = (event: PointerEvent): void => {
    if (event.button !== 0) return
    event.preventDefault()
    /** Press position that every move is measured against. */
    const startClientYPx = event.clientY
    isDragging = true
    onResizeStart()
    document.body.style.cursor = 'ns-resize'
    document.body.style.userSelect = 'none'
    startPointerDrag({
      target: event.currentTarget as HTMLElement,
      event,
      onMove: (moveEvent) => onResize(moveEvent.clientY - startClientYPx),
      onFinish: () => {
        isDragging = false
        document.body.style.cursor = ''
        document.body.style.userSelect = ''
      }
    })
  }
</script>

<!-- Zero-height anchor positions the sash on the following section's top edge without taking layout space. -->
<div class="editor-split-handle-anchor">
  <ResizeSash
    orientation="horizontal"
    {isDragging}
    {label}
    {testId}
    tabindex={-1}
    onpointerdown={startResize}
  />
</div>

<style>
  .editor-split-handle-anchor {
    height: 0;
    position: relative;
  }
</style>
