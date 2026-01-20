<script lang="ts">
  import { onDestroy } from 'svelte'

  type Props = {
    scrollTopPx: number
    viewportHeightPx: number
    totalHeightPx: number
    widthPx: number
    onScrollTopChange: (nextScrollTop: number) => void
  }

  let { scrollTopPx, viewportHeightPx, totalHeightPx, widthPx, onScrollTopChange }: Props = $props()

  const MIN_THUMB_PX = 20

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

  let trackElement: HTMLDivElement | null = null
  let dragCleanup: (() => void) | null = null

  const clamp = (value: number, min: number, max: number): number =>
    Math.min(Math.max(value, min), max)

  const applyThumbTop = (nextThumbTop: number) => {
    if (maxScrollTopPx <= 0 || maxThumbTopPx <= 0) {
      onScrollTopChange(0)
      return
    }

    const nextScrollTop = (nextThumbTop / maxThumbTopPx) * maxScrollTopPx
    onScrollTopChange(nextScrollTop)
  }

  const handleThumbPointerDown = (event: PointerEvent) => {
    if (!trackElement) return
    event.preventDefault()

    const rect = trackElement.getBoundingClientRect()
    const clickOffset = event.clientY - rect.top
    const dragOffsetPx = clamp(clickOffset - thumbTopPx, 0, thumbHeightPx)

    const handlePointerMove = (moveEvent: PointerEvent) => {
      const nextThumbTop = clamp(moveEvent.clientY - rect.top - dragOffsetPx, 0, maxThumbTopPx)
      applyThumbTop(nextThumbTop)
    }

    const handlePointerUp = () => {
      dragCleanup?.()
      dragCleanup = null
    }

    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', handlePointerUp, { once: true })

    dragCleanup = () => {
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', handlePointerUp)
    }
  }

  const handleTrackPointerDown = (event: PointerEvent) => {
    if (!trackElement || event.target !== trackElement) return
    event.preventDefault()

    const rect = trackElement.getBoundingClientRect()
    const clickOffset = event.clientY - rect.top
    const nextThumbTop = clamp(clickOffset - thumbHeightPx / 2, 0, maxThumbTopPx)
    applyThumbTop(nextThumbTop)
  }

  // Side effect: ensure global pointer listeners are removed on unmount.
  onDestroy(() => {
    dragCleanup?.()
  })
</script>

<div
  class="virtual-window-scrollbar"
  style={`width:${widthPx}px;`}
  aria-hidden="true"
>
  <div
    bind:this={trackElement}
    class="virtual-window-scrollbar-track"
    onpointerdown={handleTrackPointerDown}
  >
    <div
      class="virtual-window-scrollbar-thumb"
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

  .virtual-window-scrollbar-track {
    position: relative;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.08);
    cursor: pointer;
  }

  .virtual-window-scrollbar-thumb {
    position: absolute;
    left: 2px;
    right: 2px;
    background: rgba(255, 255, 255, 0.8);
    border-radius: 6px;
    cursor: grab;
    touch-action: none;
  }
</style>
