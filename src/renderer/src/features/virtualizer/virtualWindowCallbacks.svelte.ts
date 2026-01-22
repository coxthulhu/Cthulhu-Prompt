import type {
  ScrollToWithinWindowBand,
  ScrollToAndTrackRowCentered,
  VirtualWindowScrollApi
} from './virtualWindowTypes'

type VirtualWindowCallbacksOptions<TRow extends { kind: string }> = {
  getOnScrollToWithinWindowBand: () =>
    | ((scrollToWithinWindowBand: ScrollToWithinWindowBand) => void)
    | undefined
  scrollToWithinWindowBand: ScrollToWithinWindowBand
  getOnScrollToAndTrackRowCentered: () =>
    | ((scrollToAndTrackRowCentered: ScrollToAndTrackRowCentered) => void)
    | undefined
  scrollToAndTrackRowCentered: ScrollToAndTrackRowCentered
  getOnCenterRowChange: () => ((row: TRow | null, rowId: string | null) => void) | undefined
  getCenterRowId: () => string | null
  getCenterRowData: () => TRow | null
  getOnScrollApi: () => ((api: VirtualWindowScrollApi) => void) | undefined
  getScrollApi: () => VirtualWindowScrollApi
  getOnViewportMetricsChange: () =>
    | ((metrics: { widthPx: number; heightPx: number; devicePixelRatio: number }) => void)
    | undefined
  getMeasurementWidth: () => number
  getViewportHeight: () => number
  getDevicePixelRatio: () => number
}

export const useVirtualWindowCallbacks = <TRow extends { kind: string }>(
  options: VirtualWindowCallbacksOptions<TRow>
) => {
  const {
    getOnScrollToWithinWindowBand,
    scrollToWithinWindowBand,
    getOnScrollToAndTrackRowCentered,
    scrollToAndTrackRowCentered,
    getOnCenterRowChange,
    getCenterRowId,
    getCenterRowData,
    getOnScrollApi,
    getScrollApi,
    getOnViewportMetricsChange,
    getMeasurementWidth,
    getViewportHeight,
    getDevicePixelRatio
  } = options

  let lastScrollToWithinWindowBandCallback:
    | ((scrollToWithinWindowBand: ScrollToWithinWindowBand) => void)
    | null = null
  let lastScrollToAndTrackRowCenteredCallback:
    | ((scrollToAndTrackRowCentered: ScrollToAndTrackRowCentered) => void)
    | null = null
  let lastCenterRowChangeCallback: ((row: TRow | null, rowId: string | null) => void) | null = null
  let lastCenterRowId: string | null = null
  let lastScrollApiCallback: ((api: VirtualWindowScrollApi) => void) | null = null
  let lastViewportMetricsCallback:
    | ((metrics: { widthPx: number; heightPx: number; devicePixelRatio: number }) => void)
    | null = null
  let lastViewportMetrics:
    | { widthPx: number; heightPx: number; devicePixelRatio: number }
    | null = null

  // Side effect: expose the scroll helper once per callback change.
  $effect(() => {
    const onScrollToWithinWindowBand = getOnScrollToWithinWindowBand()
    if (!onScrollToWithinWindowBand) {
      lastScrollToWithinWindowBandCallback = null
      return
    }
    if (onScrollToWithinWindowBand === lastScrollToWithinWindowBandCallback) return
    lastScrollToWithinWindowBandCallback = onScrollToWithinWindowBand
    onScrollToWithinWindowBand(scrollToWithinWindowBand)
  })

  // Side effect: expose the tracked centered scroll helper once per callback change.
  $effect(() => {
    const onScrollToAndTrackRowCentered = getOnScrollToAndTrackRowCentered()
    if (!onScrollToAndTrackRowCentered) {
      lastScrollToAndTrackRowCenteredCallback = null
      return
    }
    if (onScrollToAndTrackRowCentered === lastScrollToAndTrackRowCenteredCallback) return
    lastScrollToAndTrackRowCenteredCallback = onScrollToAndTrackRowCentered
    onScrollToAndTrackRowCentered(scrollToAndTrackRowCentered)
  })

  // Side effect: notify consumers when the centered eligible row changes.
  $effect(() => {
    const onCenterRowChange = getOnCenterRowChange()
    if (!onCenterRowChange) {
      lastCenterRowChangeCallback = null
      lastCenterRowId = null
      return
    }

    if (onCenterRowChange !== lastCenterRowChangeCallback) {
      lastCenterRowChangeCallback = onCenterRowChange
      lastCenterRowId = null
    }

    const centerRowId = getCenterRowId()
    if (centerRowId === lastCenterRowId) return
    lastCenterRowId = centerRowId
    onCenterRowChange(getCenterRowData(), centerRowId)
  })

  // Side effect: expose the scroll API once per callback change.
  $effect(() => {
    const onScrollApi = getOnScrollApi()
    if (!onScrollApi) {
      lastScrollApiCallback = null
      return
    }
    if (onScrollApi === lastScrollApiCallback) return
    lastScrollApiCallback = onScrollApi
    onScrollApi(getScrollApi())
  })

  // Side effect: share viewport metrics so callers can align measurements.
  $effect(() => {
    const onViewportMetricsChange = getOnViewportMetricsChange()
    if (!onViewportMetricsChange) {
      lastViewportMetricsCallback = null
      lastViewportMetrics = null
      return
    }

    const metrics = {
      widthPx: getMeasurementWidth(),
      heightPx: getViewportHeight(),
      devicePixelRatio: getDevicePixelRatio()
    }

    if (onViewportMetricsChange !== lastViewportMetricsCallback) {
      lastViewportMetricsCallback = onViewportMetricsChange
      lastViewportMetrics = null
    }

    if (
      lastViewportMetrics &&
      lastViewportMetrics.widthPx === metrics.widthPx &&
      lastViewportMetrics.heightPx === metrics.heightPx &&
      lastViewportMetrics.devicePixelRatio === metrics.devicePixelRatio
    ) {
      return
    }

    lastViewportMetrics = metrics
    onViewportMetricsChange(metrics)
  })
}
