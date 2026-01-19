<script lang="ts">
  import { onDestroy } from 'svelte'

  let {
    defaultWidth,
    minWidth,
    maxWidth,
    sidebar,
    content,
    containerClass = 'h-screen',
    handleTestId = 'resizable-sidebar-handle'
  } = $props<{
    defaultWidth: number
    minWidth: number
    maxWidth: number
    sidebar: () => unknown
    content: () => unknown
    containerClass?: string
    handleTestId?: string
  }>()

  // Snapshot the initial width so prop updates don't override drag changes.
  const getInitialWidth = () => defaultWidth
  let width = $state(getInitialWidth())
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
    width = Math.min(Math.max(nextWidth, minWidth), maxWidth)
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

  // Ensure drag state is cleared if the component unmounts mid-drag.
  onDestroy(stopDragging)
</script>

<div class={`flex w-full overflow-hidden ${containerClass}`} style={`--sidebar-width: ${width}px`}>
  <div class="relative flex-shrink-0 border-r border-border" style={`width: ${width}px`}>
    {@render sidebar()}

    <button
      type="button"
      class="absolute right-0 top-0 h-full w-1.5 translate-x-1/2 cursor-ew-resize bg-transparent z-10"
      data-testid={handleTestId}
      aria-label="Resize sidebar"
      onmousedown={handleMouseDown}
    ></button>
  </div>

  <div class="flex-1 min-w-0 min-h-0 flex">
    {@render content()}
  </div>
</div>
