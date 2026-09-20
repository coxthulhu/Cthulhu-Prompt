<script lang="ts">
  import { onDestroy, untrack } from 'svelte'
  import { startPointerDrag } from '@renderer/common/drag-drop/pointerDrag'

  let {
    /** Controls whether the sidebar surface and resize handle are rendered. */
    isSidebarVisible,
    defaultWidth,
    minWidth,
    maxWidth,
    sidebar,
    content,
    containerClass = 'h-screen',
    handleTestId = 'resizable-sidebar-handle',
    sidebarInsetYPx = 0,
    sidebarInsetXPx = 0,
    sidebarInsetClass = '',
    sidebarBorderClass = '',
    onWidthChange,
    onDesiredWidthChange
  } = $props<{
    /** Controls whether the sidebar surface and resize handle are rendered. */
    isSidebarVisible: boolean
    defaultWidth: number
    minWidth: number
    maxWidth: number
    sidebar: () => unknown
    content: () => unknown
    containerClass?: string
    handleTestId?: string
    sidebarInsetYPx?: number
    sidebarInsetXPx?: number
    sidebarInsetClass?: string
    sidebarBorderClass?: string
    onWidthChange?: (widthPx: number) => void
    onDesiredWidthChange?: (widthPx: number) => void
  }>()

  // Snapshot the initial width so prop updates don't override drag changes.
  let desiredWidth = $state(untrack(() => defaultWidth))
  const width = $derived.by(() => Math.min(Math.max(desiredWidth, minWidth), maxWidth))
  let isDragging = $state(false)
  /** Cancels the active pointer session when the component unmounts. */
  let dragSession: ReturnType<typeof startPointerDrag> | null = null
  /** Horizontal pointer origin for the current resize. */
  let startPointerX = 0
  let startWidth = 0

  /** Retains the latest width while clearing all resize-only visuals. */
  const stopDragging = () => {
    dragSession = null
    isDragging = false
    document.body.style.cursor = ''
    document.body.style.userSelect = ''
    document.documentElement.style.removeProperty('--disable-transitions')
  }

  /** Applies horizontal pointer travel to the width captured at drag start. */
  const handlePointerMove = (event: PointerEvent) => {
    if (!isDragging) return
    const deltaX = event.clientX - startPointerX
    const nextWidth = startWidth + deltaX
    desiredWidth = Math.min(Math.max(nextWidth, minWidth), maxWidth)
  }

  /** Starts a captured primary-button resize for mouse, touch, or pen. */
  const handlePointerDown = (event: PointerEvent) => {
    if (event.button !== 0 || dragSession) return
    event.preventDefault()
    event.stopPropagation()
    startPointerX = event.clientX
    startWidth = width
    isDragging = true
    document.body.style.cursor = 'ew-resize'
    document.body.style.userSelect = 'none'
    // Disable transitions during drag to avoid jitter.
    document.documentElement.style.setProperty('--disable-transitions', '0s')
    dragSession = startPointerDrag({
      target: event.currentTarget as HTMLElement,
      event,
      onMove: handlePointerMove,
      onFinish: stopDragging
    })
  }

  // Side effect: keep external layouts in sync with the current sidebar width.
  $effect(() => {
    onWidthChange?.(width)
  })

  // Side effect: report drag-target width changes for persistence.
  $effect(() => {
    onDesiredWidthChange?.(desiredWidth)
  })

  // Ensure drag state is cleared if the component unmounts mid-drag.
  onDestroy(() => {
    dragSession?.cancel()
  })
</script>

<div class={`flex w-full overflow-clip ${containerClass}`} style={`--sidebar-width: ${width}px`}>
  <div
    class="resizableSidebarPane relative flex-shrink-0"
    style={`width: ${width}px`}
    hidden={!isSidebarVisible}
  >
    <div
      class={`h-full ${sidebarInsetClass}`}
      style={`padding: ${sidebarInsetYPx}px ${sidebarInsetXPx}px;`}
    >
      <div class={`relative h-full ${sidebarBorderClass}`}>
        {@render sidebar()}

        <button
          type="button"
          class="absolute top-0 right-0 h-full w-1.5 translate-x-1/2 cursor-ew-resize touch-none bg-[var(--ui-ghost-surface)] z-10"
          data-testid={handleTestId}
          aria-label="Resize sidebar"
          onpointerdown={handlePointerDown}
        ></button>
      </div>
    </div>
  </div>

  <div class="flex-1 min-w-0 min-h-0 flex">
    {@render content()}
  </div>
</div>
