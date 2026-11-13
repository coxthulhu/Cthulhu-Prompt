<script lang="ts">
  import { onDestroy } from 'svelte'
  import { startPointerDrag } from '@renderer/common/drag-drop/pointerDrag'

  type Props = {
    /** Axis the scrollbar runs along. */
    orientation?: 'vertical' | 'horizontal'
    /** Current scroll position along the axis. */
    scrollOffsetPx: number
    /** Visible extent of the scrolled area along the axis, which is also the track length. */
    viewportSizePx: number
    /** Full extent of the scrolled content along the axis. */
    contentSizePx: number
    /** Track size across the axis: its width when vertical and its height when horizontal. */
    thicknessPx: number
    overlay?: boolean
    /** Shows the scrollbar while the pointer is over the scrolled area. */
    isHovered: boolean
    revealVersion: number
    onScrollOffsetChange: (nextScrollOffset: number) => void
    /** Cancels a pending measured reveal as soon as a scroll gesture starts. */
    onScrollAttempt?: () => void
  }

  let {
    orientation = 'vertical',
    scrollOffsetPx,
    viewportSizePx,
    contentSizePx,
    thicknessPx,
    overlay = false,
    isHovered,
    revealVersion,
    onScrollOffsetChange,
    onScrollAttempt
  }: Props = $props()

  const MIN_THUMB_PX = 20
  const HIDE_TIMEOUT_MS = 500

  /** Whether the track runs left to right instead of top to bottom. */
  const isHorizontal = $derived(orientation === 'horizontal')
  const maxScrollOffsetPx = $derived(Math.max(0, contentSizePx - viewportSizePx))
  const trackLengthPx = $derived(Math.max(0, viewportSizePx))
  const thumbLengthPx = $derived.by(() => {
    if (trackLengthPx <= 0) return MIN_THUMB_PX
    if (contentSizePx <= 0) return trackLengthPx
    const rawThumbLength = (viewportSizePx / contentSizePx) * trackLengthPx
    return Math.min(trackLengthPx, Math.max(MIN_THUMB_PX, rawThumbLength))
  })
  const maxThumbOffsetPx = $derived(Math.max(0, trackLengthPx - thumbLengthPx))
  const thumbOffsetPx = $derived.by(() => {
    if (maxScrollOffsetPx <= 0) return 0
    return (scrollOffsetPx / maxScrollOffsetPx) * maxThumbOffsetPx
  })
  const isScrollbarNeeded = $derived(contentSizePx > viewportSizePx)

  let trackElement: HTMLDivElement | null = null
  let dragCleanup: (() => void) | null = null
  let visibilityClass = $state('invisible')
  let isDragging = $state(false)
  let hideTimeoutId: number | null = null

  const clamp = (value: number, min: number, max: number): number =>
    Math.min(Math.max(value, min), max)

  /** Pointer position along the axis, measured from the track's start edge. */
  const getPointerOffset = (event: PointerEvent, trackRect: DOMRect): number =>
    isHorizontal ? event.clientX - trackRect.left : event.clientY - trackRect.top

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
    if (isHovered || isDragging || !isScrollbarNeeded) return
    clearHideTimeout()
    hideTimeoutId = window.setTimeout(() => {
      if (isHovered || isDragging) return
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

  const applyThumbOffset = (nextThumbOffset: number) => {
    if (maxScrollOffsetPx <= 0 || maxThumbOffsetPx <= 0) {
      onScrollOffsetChange(0)
      return
    }

    const nextScrollOffset = (nextThumbOffset / maxThumbOffsetPx) * maxScrollOffsetPx
    onScrollOffsetChange(nextScrollOffset)
  }

  /** Captures a thumb or track press while preserving its initial thumb offset. */
  const startDragging = (event: PointerEvent, dragOffsetPx: number) => {
    if (!trackElement) return
    onScrollAttempt?.()
    const rect = trackElement.getBoundingClientRect()
    revealScrollbar()
    isDragging = true

    const handlePointerMove = (moveEvent: PointerEvent) => {
      const nextThumbOffset = clamp(getPointerOffset(moveEvent, rect) - dragOffsetPx, 0, maxThumbOffsetPx)
      applyThumbOffset(nextThumbOffset)
    }

    const handlePointerUp = () => {
      dragCleanup = null
      isDragging = false
      if (isHovered) {
        revealScrollbar()
        return
      }
      hideScrollbar(true)
    }

    /** Captured thumb or track owns this scroll gesture until completion. */
    const session = startPointerDrag({
      target: event.currentTarget as HTMLElement,
      event,
      onMove: handlePointerMove,
      onFinish: handlePointerUp
    })
    dragCleanup = session.cancel
  }

  const handleThumbPointerDown = (event: PointerEvent) => {
    if (!trackElement || event.button !== 0 || isDragging) return
    event.preventDefault()

    const clickOffset = getPointerOffset(event, trackElement.getBoundingClientRect())
    const dragOffsetPx = clamp(clickOffset - thumbOffsetPx, 0, thumbLengthPx)
    startDragging(event, dragOffsetPx)
  }

  const handleTrackPointerDown = (event: PointerEvent) => {
    if (!trackElement || event.target !== trackElement || event.button !== 0 || isDragging) return
    event.preventDefault()

    const clickOffset = getPointerOffset(event, trackElement.getBoundingClientRect())
    const nextThumbOffset = clamp(clickOffset - thumbLengthPx / 2, 0, maxThumbOffsetPx)
    applyThumbOffset(nextThumbOffset)
    startDragging(event, thumbLengthPx / 2)
  }

  // Side effect: keep scrollbar visibility aligned with hover state.
  $effect(() => {
    if (isHovered) {
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
    if (isHovered) {
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
  class={`app-scrollbar ${visibilityClass}`}
  class:app-scrollbar--overlay={overlay}
  data-orientation={orientation}
  style={isHorizontal ? `height:${thicknessPx}px;` : `width:${thicknessPx}px;`}
  aria-hidden="true"
>
  <div
    bind:this={trackElement}
    class="app-scrollbar-track"
    role="button"
    tabindex="-1"
    onpointerdown={handleTrackPointerDown}
  >
    <div
      class="app-scrollbar-thumb"
      role="button"
      tabindex="-1"
      class:active={isDragging}
      style={isHorizontal
        ? `width:${thumbLengthPx}px; transform:translate3d(${thumbOffsetPx}px, 0, 0);`
        : `height:${thumbLengthPx}px; transform:translate3d(0, ${thumbOffsetPx}px, 0);`}
      onpointerdown={handleThumbPointerDown}
    ></div>
  </div>
</div>

<style>
  .app-scrollbar {
    display: flex;
    height: 100%;
    flex: 0 0 auto;
    user-select: none;
  }

  .app-scrollbar[data-orientation='horizontal'] {
    width: 100%;
  }

  .app-scrollbar--overlay {
    position: absolute;
    top: 0;
    right: 0;
    bottom: 0;
  }

  /* A horizontal overlay runs along the bottom edge of the scrolled area. */
  .app-scrollbar--overlay[data-orientation='horizontal'] {
    top: auto;
    left: 0;
  }

  .app-scrollbar.visible {
    transition: opacity var(--ui-animation-duration-standard) linear;
    z-index: var(--z-chrome);
  }

  .app-scrollbar.invisible {
    opacity: 0;
    pointer-events: none;
  }

  .app-scrollbar.invisible.fade {
    transition: opacity 800ms linear;
  }

  .app-scrollbar-track {
    touch-action: none;
    position: relative;
    width: 100%;
    height: 100%;
  }

  .app-scrollbar-thumb {
    position: absolute;
    left: 0;
    right: 0;
    background: rgba(121, 121, 121, 0.4);
    touch-action: none;
  }

  .app-scrollbar[data-orientation='horizontal'] .app-scrollbar-thumb {
    top: 0;
    bottom: 0;
  }

  .app-scrollbar-thumb:hover {
    background: rgba(100, 100, 100, 0.7);
  }

  .app-scrollbar-thumb.active {
    background: rgba(191, 191, 191, 0.4);
  }
</style>
