import { onMount } from 'svelte'

type VirtualWindowMeasurementsOptions = {
  getViewportFrame: () => HTMLDivElement | null
  getLeftScrollPaddingPx: () => number
  getRightScrollPaddingPx: () => number
  getScrollbarWidthPx: () => number
  /** Captures the visible row before publishing a new measurement width. */
  onBeforeWidthChange: () => void
}

export const createVirtualWindowMeasurements = (options: VirtualWindowMeasurementsOptions) => {
  const { getViewportFrame, getLeftScrollPaddingPx, getRightScrollPaddingPx, getScrollbarWidthPx } =
    options

  let containerWidth = $state(0)
  let viewportHeight = $state(0)
  let devicePixelRatio = $state(1)
  let widthResizeActive = $state(false)
  let previousWidthPx = 0
  let widthResizeVersion = 0
  let widthResizeResetHandle: number | null = null
  const WIDTH_RESIZE_IDLE_DELAY_MS = 100

  // Subtract internal padding so width-based height measurements match the row content width.
  const measurementWidth = $derived(
    Math.max(
      0,
      containerWidth - getLeftScrollPaddingPx() - getRightScrollPaddingPx() - getScrollbarWidthPx()
    )
  )

  const scheduleWidthResizeIdleReset = (version: number) => {
    if (widthResizeResetHandle != null) {
      window.clearTimeout(widthResizeResetHandle)
      widthResizeResetHandle = null
    }
    widthResizeResetHandle = window.setTimeout(() => {
      if (widthResizeVersion !== version) return
      widthResizeActive = false
      widthResizeResetHandle = null
    }, WIDTH_RESIZE_IDLE_DELAY_MS)
  }

  const applyContainerWidth = (nextWidth: number) => {
    if (nextWidth > 0 && previousWidthPx > 0 && nextWidth !== previousWidthPx) {
      options.onBeforeWidthChange()
      widthResizeActive = true
      scheduleWidthResizeIdleReset(++widthResizeVersion)
    }
    containerWidth = nextWidth
    if (nextWidth > 0) previousWidthPx = nextWidth
  }

  // Side effect: track viewport sizing and width changes to drive row measurement.
  onMount(() => {
    const viewportFrame = getViewportFrame()
    if (viewportFrame) {
      viewportHeight = viewportFrame.clientHeight
      applyContainerWidth(Math.round(viewportFrame.clientWidth))
    }

    const resizeObserver = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (!entry) return
      applyContainerWidth(Math.round(entry.contentRect.width))
      viewportHeight = entry.contentRect.height
    })

    if (viewportFrame) {
      resizeObserver.observe(viewportFrame)
    }

    return () => {
      resizeObserver.disconnect()
      if (widthResizeResetHandle != null) {
        window.clearTimeout(widthResizeResetHandle)
        widthResizeResetHandle = null
      }
    }
  })

  // Side effect: capture device pixel ratio so measurements stay in sync with zoom changes.
  onMount(() => {
    const applyDevicePixelRatio = () => {
      devicePixelRatio = window.devicePixelRatio
    }

    const dprQuery = window.matchMedia('(resolution: 1dppx)')
    applyDevicePixelRatio()
    window.addEventListener('resize', applyDevicePixelRatio)
    dprQuery.addEventListener('change', applyDevicePixelRatio)

    return () => {
      window.removeEventListener('resize', applyDevicePixelRatio)
      dprQuery.removeEventListener('change', applyDevicePixelRatio)
    }
  })

  return {
    getMeasurementWidth: () => measurementWidth,
    getViewportHeight: () => viewportHeight,
    getDevicePixelRatio: () => devicePixelRatio,
    getWidthResizeActive: () => widthResizeActive
  }
}
