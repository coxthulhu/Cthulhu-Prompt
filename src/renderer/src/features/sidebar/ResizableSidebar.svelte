<script lang="ts">
  import { onDestroy, untrack } from 'svelte'
  import {
    registerSidebar,
    updateSidebar,
    unregisterSidebar,
    getSidebarWidth
  } from './sidebarSizingState.svelte.ts'

  let {
    defaultWidth,
    minWidth,
    maxWidth,
    sidebar,
    content,
    containerClass = 'h-screen',
    handleTestId = 'resizable-sidebar-handle',
    sidebarInsetYPx = 0,
    sidebarBorderClass = 'border-border',
    onWidthChange
  } = $props<{
    defaultWidth: number
    minWidth: number
    maxWidth: number
    sidebar: () => unknown
    content: () => unknown
    containerClass?: string
    handleTestId?: string
    sidebarInsetYPx?: number
    sidebarBorderClass?: string
    onWidthChange?: (widthPx: number) => void
  }>()

  // Snapshot the initial width so prop updates don't override drag changes.
  const getInitialWidth = () => defaultWidth
  let desiredWidth = $state(getInitialWidth())
  const sidebarId = registerSidebar({
    desiredWidth: getInitialWidth(),
    minWidth: untrack(() => minWidth),
    maxWidth: untrack(() => maxWidth)
  })
  const width = $derived.by(() => getSidebarWidth(sidebarId) ?? desiredWidth)
  let isDragging = $state(false)
  let startMouseX = 0
  let startWidth = 0

  const stopDragging = () => {
    isDragging = false
    document.body.style.cursor = ''
    document.body.style.userSelect = ''
    document.documentElement.style.removeProperty('--disable-transitions')
  }

  const handleMouseMove = (event: MouseEvent) => {
    if (!isDragging) return
    const deltaX = event.clientX - startMouseX
    const nextWidth = startWidth + deltaX
    desiredWidth = Math.min(Math.max(nextWidth, minWidth), maxWidth)
  }

  const handleMouseDown = (event: MouseEvent) => {
    event.preventDefault()
    event.stopPropagation()
    startMouseX = event.clientX
    startWidth = width
    isDragging = true
    document.body.style.cursor = 'ew-resize'
    document.body.style.userSelect = 'none'
    // Disable transitions during drag to avoid jitter.
    document.documentElement.style.setProperty('--disable-transitions', '0s')
  }

  // Attach global listeners only while dragging so the rest of the app keeps pointer events.
  $effect(() => {
    if (!isDragging) return
    window.addEventListener('mousemove', handleMouseMove, { passive: false })
    window.addEventListener('mouseup', stopDragging)
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', stopDragging)
    }
  })

  // Side effect: sync this sidebar's sizing preferences with the global coordinator.
  $effect(() => {
    updateSidebar(sidebarId, { desiredWidth, minWidth, maxWidth })
  })

  // Side effect: keep external layouts in sync with the current sidebar width.
  $effect(() => {
    onWidthChange?.(width)
  })

  // Ensure drag state is cleared and the sidebar unregisters if the component unmounts mid-drag.
  onDestroy(() => {
    stopDragging()
    unregisterSidebar(sidebarId)
  })
</script>

<div class={`flex w-full overflow-hidden ${containerClass}`} style={`--sidebar-width: ${width}px`}>
  <div class="relative flex-shrink-0" style={`width: ${width}px`}>
    <div class="h-full" style={`padding: ${sidebarInsetYPx}px 0;`}>
      <div class={`relative h-full border-r ${sidebarBorderClass}`}>
        {@render sidebar()}

        <button
          type="button"
          class="absolute right-0 top-0 h-full w-1.5 translate-x-1/2 cursor-ew-resize bg-transparent z-10"
          data-testid={handleTestId}
          aria-label="Resize sidebar"
          onmousedown={handleMouseDown}
        ></button>
      </div>
    </div>
  </div>

  <div class="flex-1 min-w-0 min-h-0 flex">
    {@render content()}
  </div>
</div>
