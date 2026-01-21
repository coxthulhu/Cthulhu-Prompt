import type {
  ScrollToWithinWindowBand,
  ScrollToRowCentered,
  VirtualWindowScrollApi
} from './virtualWindowTypes'

type VirtualWindowCallbacksOptions<TRow extends { kind: string }> = {
  getOnScrollToWithinWindowBand: () =>
    | ((scrollToWithinWindowBand: ScrollToWithinWindowBand) => void)
    | undefined
  scrollToWithinWindowBand: ScrollToWithinWindowBand
  getOnScrollToRowCentered: () => ((scrollToRowCentered: ScrollToRowCentered) => void) | undefined
  scrollToRowCentered: ScrollToRowCentered
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
    getOnScrollToRowCentered,
    scrollToRowCentered,
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
  let lastScrollToRowCenteredCallback: ((scrollToRowCentered: ScrollToRowCentered) => void) | null =
    null
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

  // Side effect: expose the centered scroll helper once per callback change.
  $effect(() => {
    const onScrollToRowCentered = getOnScrollToRowCentered()
    if (!onScrollToRowCentered) {
      lastScrollToRowCenteredCallback = null
      return
    }
    if (onScrollToRowCentered === lastScrollToRowCenteredCallback) return
    lastScrollToRowCenteredCallback = onScrollToRowCentered
    onScrollToRowCentered(scrollToRowCentered)
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
