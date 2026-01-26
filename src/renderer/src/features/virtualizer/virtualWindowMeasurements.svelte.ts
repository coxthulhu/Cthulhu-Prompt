import { onMount } from 'svelte'

type VirtualWindowMeasurementsOptions = {
  getViewportFrame: () => HTMLDivElement | null
  getLeftScrollPaddingPx: () => number
  getRightScrollPaddingPx: () => number
  scrollbarWidthPx: number
}

export const createVirtualWindowMeasurements = (options: VirtualWindowMeasurementsOptions) => {
  const {
    getViewportFrame,
    getLeftScrollPaddingPx,
    getRightScrollPaddingPx,
    scrollbarWidthPx
  } = options

  let containerWidth = $state(0)
  let viewportHeight = $state(0)
  let devicePixelRatio = $state(1)
  let widthResizeActive = $state(false)
  let hasInitializedWidth = false
  let previousWidthPx = 0
  let widthResizeVersion = 0
  let widthResizeResetHandle: number | null = null
  const WIDTH_RESIZE_IDLE_DELAY_MS = 100

  // Subtract internal padding so width-based height measurements match the row content width.
  const measurementWidth = $derived(
    Math.max(
      0,
      containerWidth - getLeftScrollPaddingPx() - getRightScrollPaddingPx() - scrollbarWidthPx
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
    containerWidth = nextWidth
    if (nextWidth <= 0) return
    if (!hasInitializedWidth) {
      hasInitializedWidth = true
      previousWidthPx = nextWidth
      return
    }
    if (nextWidth === previousWidthPx) return
    previousWidthPx = nextWidth
    widthResizeActive = true
    const version = (widthResizeVersion += 1)
    scheduleWidthResizeIdleReset(version)
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
      viewportHeight = entry.contentRect.height
      applyContainerWidth(Math.round(entry.contentRect.width))
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
