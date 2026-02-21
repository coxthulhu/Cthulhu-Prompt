<script lang="ts">
  import { onDestroy } from 'svelte'

  type Props = {
    scrollTopPx: number
    viewportHeightPx: number
    totalHeightPx: number
    widthPx: number
    isPointerOverWindow: boolean
    revealVersion: number
    onScrollTopChange: (nextScrollTop: number) => void
  }

  let {
    scrollTopPx,
    viewportHeightPx,
    totalHeightPx,
    widthPx,
    isPointerOverWindow,
    revealVersion,
    onScrollTopChange
  }: Props = $props()

  const MIN_THUMB_PX = 20
  const HIDE_TIMEOUT_MS = 500

  const maxScrollTopPx = $derived(Math.max(0, totalHeightPx - viewportHeightPx))
  const trackHeightPx = $derived(Math.max(0, viewportHeightPx))
  const thumbHeightPx = $derived.by(() => {
    if (trackHeightPx <= 0) return MIN_THUMB_PX
    if (totalHeightPx <= 0) return trackHeightPx
    const rawThumbHeight = (viewportHeightPx / totalHeightPx) * trackHeightPx
    return Math.min(trackHeightPx, Math.max(MIN_THUMB_PX, rawThumbHeight))
  })
  const maxThumbTopPx = $derived(Math.max(0, trackHeightPx - thumbHeightPx))
  const thumbTopPx = $derived.by(() => {
    if (maxScrollTopPx <= 0) return 0
    return (scrollTopPx / maxScrollTopPx) * maxThumbTopPx
  })
  const isScrollbarNeeded = $derived(totalHeightPx > viewportHeightPx)

  let trackElement: HTMLDivElement | null = null
  let dragCleanup: (() => void) | null = null
  let visibilityClass = $state('invisible')
  let isDragging = $state(false)
  let hideTimeoutId: number | null = null

  const clamp = (value: number, min: number, max: number): number =>
    Math.min(Math.max(value, min), max)

  const clearHideTimeout = () => {
    if (hideTimeoutId == null) return
    window.clearTimeout(hideTimeoutId)
    hideTimeoutId = null
  }

  const hideScrollbar = (withFade: boolean) => {
    clearHideTimeout()
    visibilityClass = withFade ? 'invisible fade' : 'invisible'
  }

  const scheduleHide = () => {
    if (isPointerOverWindow || isDragging || !isScrollbarNeeded) return
    clearHideTimeout()
    hideTimeoutId = window.setTimeout(() => {
      if (isPointerOverWindow || isDragging) return
      visibilityClass = 'invisible fade'
    }, HIDE_TIMEOUT_MS)
  }

  const revealScrollbar = () => {
    if (!isScrollbarNeeded) {
      hideScrollbar(false)
      return
    }
    clearHideTimeout()
    visibilityClass = 'visible'
    scheduleHide()
  }

  const applyThumbTop = (nextThumbTop: number) => {
    if (maxScrollTopPx <= 0 || maxThumbTopPx <= 0) {
      onScrollTopChange(0)
      return
    }

    const nextScrollTop = (nextThumbTop / maxThumbTopPx) * maxScrollTopPx
    onScrollTopChange(nextScrollTop)
  }

  const startDragging = (dragOffsetPx: number) => {
    if (!trackElement) return
    const rect = trackElement.getBoundingClientRect()
    revealScrollbar()
    isDragging = true

    const handlePointerMove = (moveEvent: PointerEvent) => {
      const nextThumbTop = clamp(moveEvent.clientY - rect.top - dragOffsetPx, 0, maxThumbTopPx)
      applyThumbTop(nextThumbTop)
    }

    const handlePointerUp = () => {
      dragCleanup?.()
      dragCleanup = null
      isDragging = false
      if (isPointerOverWindow) {
        revealScrollbar()
        return
      }
      hideScrollbar(true)
    }

    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', handlePointerUp, { once: true })

    dragCleanup = () => {
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', handlePointerUp)
    }
  }

  const handleThumbPointerDown = (event: PointerEvent) => {
    if (!trackElement) return
    event.preventDefault()

    const rect = trackElement.getBoundingClientRect()
    const clickOffset = event.clientY - rect.top
    const dragOffsetPx = clamp(clickOffset - thumbTopPx, 0, thumbHeightPx)
    startDragging(dragOffsetPx)
  }

  const handleTrackPointerDown = (event: PointerEvent) => {
    if (!trackElement || event.target !== trackElement) return
    event.preventDefault()

    const rect = trackElement.getBoundingClientRect()
    const clickOffset = event.clientY - rect.top
    const nextThumbTop = clamp(clickOffset - thumbHeightPx / 2, 0, maxThumbTopPx)
    applyThumbTop(nextThumbTop)
    startDragging(thumbHeightPx / 2)
  }

  // Side effect: keep scrollbar visibility aligned with hover state.
  $effect(() => {
    if (isPointerOverWindow) {
      revealScrollbar()
      return
    }
    if (!isDragging) {
      hideScrollbar(true)
    }
  })

  // Side effect: reveal the scrollbar while scrolling.
  $effect(() => {
    if (revealVersion === 0) return
    revealScrollbar()
  })

  // Side effect: hide the scrollbar when the content fits, reveal when needed and hovered.
  $effect(() => {
    if (!isScrollbarNeeded) {
      hideScrollbar(false)
      return
    }
    if (isPointerOverWindow) {
      revealScrollbar()
    }
  })

  // Side effect: ensure global pointer listeners are removed on unmount.
  onDestroy(() => {
    dragCleanup?.()
    clearHideTimeout()
  })
</script>

<div
  class={`virtual-window-scrollbar ${visibilityClass}`}
  style={`width:${widthPx}px;`}
  aria-hidden="true"
>
  <div
    bind:this={trackElement}
    class="virtual-window-scrollbar-track"
    role="button"
    tabindex="-1"
    onpointerdown={handleTrackPointerDown}
  >
    <div
      class="virtual-window-scrollbar-thumb"
      role="button"
      tabindex="-1"
      class:active={isDragging}
      style={`height:${thumbHeightPx}px; transform:translate3d(0, ${thumbTopPx}px, 0);`}
      onpointerdown={handleThumbPointerDown}
    ></div>
  </div>
</div>

<style>
  .virtual-window-scrollbar {
    display: flex;
    height: 100%;
    flex: 0 0 auto;
    user-select: none;
  }

  .virtual-window-scrollbar.visible {
    opacity: 1;
    background: rgba(0, 0, 0, 0);
    transition: opacity 100ms linear;
    z-index: 11;
  }

  .virtual-window-scrollbar.invisible {
    opacity: 0;
    pointer-events: none;
  }

  .virtual-window-scrollbar.invisible.fade {
    transition: opacity 800ms linear;
  }

  .virtual-window-scrollbar-track {
    position: relative;
    width: 100%;
    height: 100%;
    background: transparent;
  }

  .virtual-window-scrollbar-thumb {
    position: absolute;
    left: 0;
    right: 0;
    background: var(--vscode-scrollbarSlider-background);
    touch-action: none;
  }

  .virtual-window-scrollbar-thumb:hover {
    background: var(--vscode-scrollbarSlider-hoverBackground);
  }

  .virtual-window-scrollbar-thumb.active {
    background: var(--vscode-scrollbarSlider-activeBackground);
  }
</style>
